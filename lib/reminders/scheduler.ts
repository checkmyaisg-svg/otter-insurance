// ============================================================================
// lib/reminders/scheduler.ts
//
// WHY THIS EXISTS
// The scheduling engine is business-critical: it decides exactly which WhatsApp
// reminders a policy should have and when. It is implemented as PURE TypeScript
// (no DB, no I/O, no triggers) so every business rule is deterministic and unit
// testable. Server actions (Milestone 5) call these functions and persist the
// result inside a transaction; the send job (Milestone 8) consumes the rows.
//
// TIMEZONE MODEL
// All wall-clock reminder times are defined in Asia/Singapore. Singapore has a
// FIXED offset of UTC+08:00 and observes NO daylight saving, so we can express
// SGT instants as ISO strings with an explicit "+08:00" offset and let the JS
// Date engine convert to the correct UTC instant. This avoids pulling a tz
// library. If this system ever serves a DST-observing region, swap buildSgtInstant
// for a proper tz-aware implementation (luxon/Temporal) — that is the ONLY place
// the assumption lives.
// ============================================================================

import { POLICY_BEHAVIOR, PAYMENT_MODE_INTERVAL_MONTHS } from '../policies/behavior';
import type { PolicyType, PaymentMode } from '../policies/behavior';

export type { PolicyType, PaymentMode };
export type PolicyStatus = 'active' | 'expired' | 'cancelled';

export type AutomatedMessageType =
  | 'travel_departure'
  | 'travel_return'
  | 'renewal_60'
  | 'renewal_30'
  | 'renewal_7'
  | 'premium_due'
  | 'anniversary';

export type ScheduledStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

/** Minimal policy shape the scheduler needs. Dates are 'YYYY-MM-DD' (date-only). */
export interface PolicyInput {
  id: string;
  agentId: string;
  clientId: string;
  policyType: PolicyType;
  destination: string | null;
  startDate: string; // travel: departure date | car/home: policy start
  endDate: string; // travel: return date    | car/home: policy end
  renewalDate: string | null; // renewable types (car/home/health) only
  /** protection types (life/ci): drives premium-due cadence. Null = no premium reminders. */
  paymentMode: PaymentMode | null;
  status: PolicyStatus;
}

/** A reminder the scheduler wants to exist. Maps 1:1 to a scheduled_messages row. */
export interface PlannedReminder {
  policyId: string;
  agentId: string;
  clientId: string;
  messageType: AutomatedMessageType;
  scheduledAt: string; // ISO-8601 UTC instant, e.g. '2026-08-15T00:00:00.000Z'
  templateName: string; // intended template at schedule time; send job may re-stamp
  idempotencyKey: string; // deterministic: policyId:messageType:scheduledAt
}

/** An existing reminder row as loaded from the DB, for reconciliation. */
export interface ExistingReminder {
  id: string;
  policyId: string;
  messageType: AutomatedMessageType;
  scheduledAt: string; // ISO UTC
  status: ScheduledStatus;
}

/** The diff a caller applies inside a transaction. */
export interface ReconcileResult {
  toInsert: PlannedReminder[];
  toUpdate: Array<{ id: string; scheduledAt: string; idempotencyKey: string }>;
  toCancelIds: string[];
}

// ----------------------------------------------------------------------------
// Configuration: reminder timing and default templates.
// Times are Asia/Singapore wall-clock. RENEWAL_OFFSET_DAYS maps each renewal
// message_type to how many days BEFORE the renewal date it fires.
// DEFAULT_TEMPLATES is a stub the WhatsApp catalogue (Milestone 6) will own;
// kept here so template_name is populated at creation for reporting. The send
// job records the template actually used, which may differ if a version was
// migrated between scheduling and sending.
// ----------------------------------------------------------------------------

const TRAVEL_DEPARTURE_HOUR_SGT = 8; // 08:00 SGT
const TRAVEL_RETURN_HOUR_SGT = 18; // 18:00 SGT
const RENEWAL_HOUR_SGT = 9; // 09:00 SGT
const PREMIUM_HOUR_SGT = 9; // 09:00 SGT
const ANNIVERSARY_HOUR_SGT = 9; // 09:00 SGT
/** Remind this many days BEFORE each premium due date. */
const PREMIUM_LEAD_DAYS = 3;
/** How far ahead protection occurrences are generated. Top-up happens on every
 * policy edit (and later, by the send job) — reconcile keeps it idempotent. */
const PROTECTION_HORIZON_DAYS = 365;

const RENEWAL_OFFSET_DAYS: Record<'renewal_60' | 'renewal_30' | 'renewal_7', number> = {
  renewal_60: 60,
  renewal_30: 30,
  renewal_7: 7,
};

const DEFAULT_TEMPLATES: Record<AutomatedMessageType, string> = {
  travel_departure: 'travel_departure_v1',
  travel_return: 'travel_return_v1',
  renewal_60: 'policy_renewal_v1',
  renewal_30: 'policy_renewal_v1',
  renewal_7: 'policy_renewal_v1',
  premium_due: 'premium_due_v1',
  anniversary: 'policy_anniversary_v1',
};

// ----------------------------------------------------------------------------
// Timezone helpers
// ----------------------------------------------------------------------------

/**
 * Build a UTC Date for a given Singapore wall-clock date + hour.
 * '2026-08-15' + 8  ->  Date('2026-08-15T08:00:00+08:00')  ->  00:00:00Z.
 * Relies on Singapore's fixed +08:00 offset (documented at top of file).
 */
export function buildSgtInstant(dateYmd: string, hourSgt: number): Date {
  const hh = String(hourSgt).padStart(2, '0');
  const iso = `${dateYmd}T${hh}:00:00+08:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for SGT instant: ${dateYmd} @ ${hourSgt}h`);
  }
  return d;
}

/**
 * Subtract N calendar days from a 'YYYY-MM-DD' date, returning 'YYYY-MM-DD'.
 * Uses UTC date parts so no timezone drift can shift the calendar day.
 */
export function subtractDays(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateYmd}`);
  }
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Add N calendar months to a 'YYYY-MM-DD' date, clamping the day to the target
 * month's length (Jan 31 + 1mo -> Feb 28/29). Uses UTC parts; no tz drift.
 */
export function addMonthsClamped(dateYmd: string, months: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number) as [number, number, number];
  const targetMonthIndex = m - 1 + months;
  const targetY = y + Math.floor(targetMonthIndex / 12);
  const targetM = ((targetMonthIndex % 12) + 12) % 12;
  // Day 0 of next month = last day of target month.
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const out = new Date(Date.UTC(targetY, targetM, day));
  return out.toISOString().slice(0, 10);
}

/** Deterministic idempotency key. Same policy+type+instant always => same key. */
export function makeIdempotencyKey(
  policyId: string,
  messageType: AutomatedMessageType,
  scheduledAtIso: string,
): string {
  return `${policyId}:${messageType}:${scheduledAtIso}`;
}

// ----------------------------------------------------------------------------
// Core: scheduleForPolicy
// ----------------------------------------------------------------------------

/**
 * Return the full set of reminders a policy SHOULD have right now.
 *
 * Business rules:
 *  - A non-active policy (expired/cancelled) schedules NOTHING. The caller is
 *    responsible for cancelling any existing pending reminders (see reconcile).
 *  - Travel   -> travel_departure (start_date 08:00 SGT), travel_return (end_date 18:00 SGT).
 *  - Car/Home -> renewal_60/30/7 at (renewal_date - N days) 09:00 SGT.
 *  - Any reminder whose computed instant is at or before `now` is SKIPPED
 *    (past-date skipping). A car policy added 20 days before renewal therefore
 *    only gets renewal_7.
 *
 * @param policy the policy to plan for
 * @param now injectable clock (defaults to real now) — makes past-skip testable
 */
export function scheduleForPolicy(policy: PolicyInput, now: Date = new Date()): PlannedReminder[] {
  // Rule: only active policies get reminders.
  if (policy.status !== 'active') {
    return [];
  }

  const planned: PlannedReminder[] = [];

  const push = (messageType: AutomatedMessageType, instant: Date) => {
    // Past-date skipping: never schedule something already due/overdue.
    if (instant.getTime() <= now.getTime()) return;
    const scheduledAt = instant.toISOString();
    planned.push({
      policyId: policy.id,
      agentId: policy.agentId,
      clientId: policy.clientId,
      messageType,
      scheduledAt,
      templateName: DEFAULT_TEMPLATES[messageType],
      idempotencyKey: makeIdempotencyKey(policy.id, messageType, scheduledAt),
    });
  };

  const behavior = POLICY_BEHAVIOR[policy.policyType];

  if (behavior === 'event') {
    push('travel_departure', buildSgtInstant(policy.startDate, TRAVEL_DEPARTURE_HOUR_SGT));
    push('travel_return', buildSgtInstant(policy.endDate, TRAVEL_RETURN_HOUR_SGT));
  } else if (behavior === 'renewable') {
    // car / home / health — renewalDate is guaranteed non-null by the DB CHECK
    // constraint, but we guard defensively since this is pure logic that could
    // be called with unvalidated input in tests or future callers.
    if (!policy.renewalDate) {
      throw new Error(`Policy ${policy.id} is ${policy.policyType} but has no renewalDate`);
    }
    (Object.keys(RENEWAL_OFFSET_DAYS) as Array<keyof typeof RENEWAL_OFFSET_DAYS>).forEach(
      (mt) => {
        const fireDate = subtractDays(policy.renewalDate!, RENEWAL_OFFSET_DAYS[mt]);
        push(mt, buildSgtInstant(fireDate, RENEWAL_HOUR_SGT));
      },
    );
  } else {
    // protection (life / ci):
    //  - premium_due: one reminder PREMIUM_LEAD_DAYS before each due date within
    //    the horizon. Due dates advance from startDate by the payment interval,
    //    with day-of-month clamping. 'single' (or missing) mode => none.
    //  - anniversary: the next policy anniversary within the horizon.
    const horizonEnd = new Date(now.getTime() + PROTECTION_HORIZON_DAYS * 86_400_000);

    const interval = policy.paymentMode
      ? PAYMENT_MODE_INTERVAL_MONTHS[policy.paymentMode]
      : null;
    if (interval !== null && interval !== undefined) {
      // Walk due dates forward from the anchor until past the horizon. Starting
      // from the anchor keeps every due date aligned to the original day-of-month
      // (clamped), even for policies that started years ago.
      for (let k = 1; ; k++) {
        const dueDate = addMonthsClamped(policy.startDate, k * interval);
        const fireInstant = buildSgtInstant(subtractDays(dueDate, PREMIUM_LEAD_DAYS), PREMIUM_HOUR_SGT);
        if (fireInstant.getTime() > horizonEnd.getTime()) break;
        push('premium_due', fireInstant); // past-date skip handled inside push
        if (k > 12 * 100) break; // safety valve; unreachable in practice
      }
    }

    // Next anniversary: startDate + N years, first occurrence strictly in the future.
    for (let years = 1; years <= 101; years++) {
      const anniv = addMonthsClamped(policy.startDate, years * 12);
      const instant = buildSgtInstant(anniv, ANNIVERSARY_HOUR_SGT);
      if (instant.getTime() <= now.getTime()) continue;
      if (instant.getTime() <= horizonEnd.getTime()) push('anniversary', instant);
      break; // only the next one, whether or not it fell inside the horizon
    }
  }

  return planned;
}

// ----------------------------------------------------------------------------
// Reconciliation: diff planned vs existing (used on policy create AND edit)
// ----------------------------------------------------------------------------

/** Statuses we must never mutate — the message already left the pending state. */
const IMMUTABLE_STATUSES: ReadonlySet<ScheduledStatus> = new Set([
  'processing',
  'sent',
  'failed',
]);

/**
 * Compute the minimal set of writes to make the DB match `planned`.
 *
 * Rules (all covered by tests):
 *  - planned type with NO existing row            -> INSERT
 *  - planned type WITH an existing 'pending' row:
 *        same scheduledAt  -> no-op
 *        changed scheduledAt -> UPDATE (new time + new idempotency key)
 *  - planned type WITH an existing immutable row (processing/sent/failed)
 *                                                 -> LEAVE ALONE (never resend/replan)
 *  - existing 'pending' row whose type is NO LONGER planned  -> CANCEL
 *  - existing 'cancelled' row                     -> ignored (already terminal)
 *
 * This is what makes policy edits safe: shifting a renewal date moves the
 * pending reminders, leaves already-sent ones untouched, and cancels any that
 * no longer apply — all against the (policy_id, message_type) unique constraint.
 */
/** Types that can occur multiple times per policy (occurrence = type + instant). */
const REPEATING_TYPES: ReadonlySet<AutomatedMessageType> = new Set(['premium_due']);

/**
 * Identity of a reminder occurrence for reconciliation pairing.
 * Single-occurrence types (all renewal/travel/anniversary) pair by TYPE alone —
 * identical to the original algorithm, so existing behavior is unchanged.
 * Repeating types (premium_due) pair by TYPE + INSTANT: an edit that shifts the
 * cadence cancels stale occurrences and inserts new ones, which is the correct
 * semantic for a recurring series (and the (policy_id, message_type,
 * scheduled_at) unique index matches this identity).
 */
function occurrenceKey(messageType: AutomatedMessageType, scheduledAt: string): string {
  return REPEATING_TYPES.has(messageType) ? `${messageType}@${scheduledAt}` : messageType;
}

export function reconcileReminders(
  existing: ExistingReminder[],
  planned: PlannedReminder[],
): ReconcileResult {
  const result: ReconcileResult = { toInsert: [], toUpdate: [], toCancelIds: [] };

  const existingByKey = new Map<string, ExistingReminder>();
  for (const e of existing) existingByKey.set(occurrenceKey(e.messageType, e.scheduledAt), e);

  const plannedKeys = new Set<string>();

  for (const p of planned) {
    const key = occurrenceKey(p.messageType, p.scheduledAt);
    plannedKeys.add(key);
    const match = existingByKey.get(key);

    if (!match) {
      result.toInsert.push(p);
      continue;
    }
    // Never touch a reminder that has already been picked up or sent.
    if (IMMUTABLE_STATUSES.has(match.status)) continue;
    // A previously cancelled row: re-inserting would violate the unique
    // constraint, so revive it via update instead of insert.
    if (match.status === 'cancelled' || match.scheduledAt !== p.scheduledAt) {
      result.toUpdate.push({
        id: match.id,
        scheduledAt: p.scheduledAt,
        idempotencyKey: p.idempotencyKey,
      });
    }
    // else: pending row already at the correct time -> no-op.
  }

  // Cancel pending rows whose occurrence is no longer planned (e.g. travel ->
  // car edit, a renewal now in the past, or a premium occurrence that moved).
  for (const e of existing) {
    if (!plannedKeys.has(occurrenceKey(e.messageType, e.scheduledAt)) && e.status === 'pending') {
      result.toCancelIds.push(e.id);
    }
  }

  return result;
}

/**
 * Reminders to cancel when a CLIENT is soft-deleted or a POLICY is cancelled.
 * Only 'pending' rows are cancelled; in-flight/sent history is preserved.
 * (DB-side, ON DELETE CASCADE also removes rows on hard delete; this handles the
 * soft-delete / status-change path explicitly.)
 */
export function remindersToCancelForDeactivation(existing: ExistingReminder[]): string[] {
  return existing.filter((e) => e.status === 'pending').map((e) => e.id);
}
