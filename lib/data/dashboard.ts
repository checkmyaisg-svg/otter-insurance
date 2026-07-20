import { createClient } from '@/lib/supabase/server';
import { daysUntilBirthday, nextBirthdayDate } from '@/lib/dates/birthday';
import { classifyQuiet, annualizedPremium } from '@/lib/intelligence/portfolio';
import { buildBriefing, type Briefing, type PortfolioClient } from '@/lib/intelligence/briefing';
import { POLICY_TYPE_LABEL, type PolicyType } from '@/lib/policies/behavior';
import { buildDraftMessage, draftKindForMessageType, firstNameOf } from '@/lib/whatsapp/templates';

/**
 * DASHBOARD ENGINE (Task Engine, V1 — derived)
 *
 * This module owns ALL business logic for the Today dashboard. The page is a
 * pure renderer. Every actionable item is a `TodayItem` with a stable shape:
 * a reason ("why look at this?"), the client, a date, a status, one action, and
 * an `href`. The href is the ACTION VIEW SEAM — today it points at the client
 * or policy record; later it can point at a focused task workspace with NO
 * change to the dashboard renderer.
 *
 * V1 items are derived from policies + scheduled_messages. V2 kinds (replies,
 * payments, persisted tasks) are intentionally NOT produced and NOT shown.
 */

export type TodayTone = 'urgent' | 'warning' | 'info' | 'neutral';

export type TodayItemKind =
  | 'overdue_renewal'
  | 'failed_message'
  | 'renewal_follow_up'
  | 'scheduled_today'
  | 'travel_departure'
  | 'upcoming_renewal'
  | 'recent_activity'
  | 'birthday'
  | 'gone_quiet';

export interface TodayItem {
  id: string;
  kind: TodayItemKind;
  clientId: string;
  clientName: string;
  /** Why the agent needs to look at this — the row's headline reason. */
  reason: string;
  /** The relevant date, preformatted for display. */
  dateLabel: string;
  /** Short status word (e.g. "Overdue", "Pending", "In 5 days"). */
  status: string;
  /** The one clear action label (e.g. "Review renewal"). */
  actionLabel: string;
  /** Where the action goes. ACTION VIEW SEAM — swap target later, no UI change. */
  href: string;
  tone: TodayTone;
  /** Prefilled WhatsApp draft for this item (null when no template applies). */
  draft: { phone: string | null; message: string; policyId: string | null } | null;
}

export interface TodaySection {
  key: string;
  title: string;
  emoji: string;
  items: TodayItem[];
}

export interface TodayData {
  briefing: Briefing;
  agentName: string;
  stats: { clients: number; activePolicies: number; renewalsThisMonth: number; remindersPending: number };
  summary: { urgent: number; followUps: number; scheduledToday: number };
  sections: TodaySection[];
}

// --- date helpers (Asia/Singapore is UTC+8, fixed; we compare calendar days) ---
function todayYmd(): string {
  // "Now" in SGT as a YYYY-MM-DD string.
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgt.toISOString().slice(0, 10);
}
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
function fmt(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function relativeStatus(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/**
 * Build the entire Today dashboard for the current agent. RLS scopes every
 * query to this agent, so no agent_id filters are needed. Returns everything the
 * renderer needs; the renderer computes nothing.
 */


export async function getToday(): Promise<TodayData> {
  const supabase = await createClient();
  const today = todayYmd();
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);
  const monthEnd = addDays(today, 31);

  const [{ data: userData }, clientsRes, birthdayClientsRes, policiesRes, remindersRes, sentHistoryRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('clients')
      .select('id, full_name, phone_number, birthday, created_at')
      .is('deleted_at', null),
    supabase
      .from('policies')
      .select('id, client_id, policy_type, destination, start_date, end_date, renewal_date, insurer, status, premium_amount, payment_mode, clients(full_name, phone_number)')
      .eq('status', 'active'),
    supabase
      .from('scheduled_messages')
      .select('client_id, scheduled_at')
      .eq('status', 'sent'),
    supabase
      .from('scheduled_messages')
      .select('id, client_id, policy_id, message_type, scheduled_at, status, clients(full_name)'),
  ]);

  const userId = userData.user?.id;
  let agentName = 'there';
  if (userId) {
    const { data: agent } = await supabase.from('agents').select('full_name').eq('id', userId).maybeSingle();
    if (agent?.full_name) agentName = (agent.full_name as string).split(' ')[0] ?? agent.full_name;
  }

  type PolicyRow = {
    id: string; client_id: string; policy_type: string; destination: string | null;
    start_date: string; end_date: string | null; renewal_date: string | null; insurer: string | null; status: string;
    clients: { full_name: string; phone_number: string | null } | null;
  };
  type ReminderRow = {
    id: string; client_id: string; policy_id: string | null; message_type: string;
    scheduled_at: string; status: string; clients: { full_name: string; phone_number: string | null } | null;
  };
  const policies = (policiesRes.data ?? []) as unknown as PolicyRow[];
  const reminders = (remindersRes.data ?? []) as unknown as ReminderRow[];

  const nameOf = (c: { full_name: string } | null) => c?.full_name ?? 'Unknown client';
  const phoneOf = (c: { phone_number?: string | null } | null) => c?.phone_number ?? null;

  // Build a renewal draft for a policy row (shared by overdue/follow-up/upcoming).
  const renewalDraft = (p: PolicyRow, overdue: boolean) => ({
    phone: phoneOf(p.clients),
    policyId: p.id,
    message: buildDraftMessage('renewal', {
      clientFirstName: firstNameOf(nameOf(p.clients)),
      policyLabel: POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? 'insurance',
      dateText: p.renewal_date ? fmt(p.renewal_date) : '',
      insurer: p.insurer,
      overdue,
    }),
  });

  // --- 1. Needs Attention: overdue renewals + failed messages ---
  const needsAttention: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date < today) {
      const d = daysBetween(p.renewal_date, today);
      needsAttention.push({
        id: `overdue-${p.id}`,
        kind: 'overdue_renewal',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `${POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? 'Policy'} policy renewal is overdue`,
        dateLabel: `Renewal was ${fmt(p.renewal_date)}`,
        status: `${d}d overdue`,
        actionLabel: 'Review renewal',
        href: `/policies/${p.id}`,
        tone: 'urgent',
        draft: renewalDraft(p, true),
      });
    }
  }
  for (const r of reminders) {
    if (r.status === 'failed') {
      needsAttention.push({
        id: `failed-${r.id}`,
        kind: 'failed_message',
        clientId: r.client_id,
        clientName: nameOf(r.clients),
        reason: 'A scheduled message failed to send',
        dateLabel: `Was due ${fmt(r.scheduled_at.slice(0, 10))}`,
        status: 'Failed',
        actionLabel: 'Investigate',
        href: r.policy_id ? `/policies/${r.policy_id}` : `/clients/${r.client_id}`,
        tone: 'urgent',
        draft: null,
      });
    }
  }

  // --- 2. Follow Up Today: renewals within 14 days needing a nudge ---
  const followUp: TodayItem[] = [];
  const in14 = addDays(today, 14);
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date >= today && p.renewal_date <= in14) {
      const d = daysBetween(today, p.renewal_date);
      followUp.push({
        id: `followup-${p.id}`,
        kind: 'renewal_follow_up',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `Renewal is close — reach out to secure it`,
        dateLabel: `Renews ${fmt(p.renewal_date)}`,
        status: relativeStatus(d),
        actionLabel: 'Follow up',
        href: `/policies/${p.id}`,
        tone: 'warning',
        draft: renewalDraft(p, false),
      });
    }
  }

  // --- 3. Scheduled Today: reminders with scheduled_at = today, still pending ---
  const scheduledToday: TodayItem[] = [];
  const policyById = new Map(policies.map((p) => [p.id, p]));
  for (const r of reminders) {
    if (r.status === 'pending' && r.scheduled_at.slice(0, 10) === today) {
      const kind = draftKindForMessageType(r.message_type);
      const pol = r.policy_id ? policyById.get(r.policy_id) : undefined;
      const draft = kind
        ? {
            phone: phoneOf(r.clients),
            policyId: r.policy_id,
            message: buildDraftMessage(kind, {
              clientFirstName: firstNameOf(nameOf(r.clients)),
              policyLabel: pol
                ? POLICY_TYPE_LABEL[pol.policy_type as PolicyType] ?? 'insurance'
                : 'insurance',
              dateText: pol?.renewal_date
                ? fmt(pol.renewal_date)
                : fmt(r.scheduled_at.slice(0, 10)),
              destination: pol?.destination ?? null,
              insurer: pol?.insurer ?? null,
            }),
          }
        : null;
      scheduledToday.push({
        id: `sched-${r.id}`,
        kind: 'scheduled_today',
        clientId: r.client_id,
        clientName: nameOf(r.clients),
        reason: labelReminder(r.message_type),
        dateLabel: 'Sending today',
        status: 'Pending',
        actionLabel: 'View',
        href: r.policy_id ? `/policies/${r.policy_id}` : `/clients/${r.client_id}`,
        tone: 'info',
        draft,
      });
    }
  }

  // --- 4. Upcoming Travel: departures within 7 days ---
  const upcomingTravel: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type === 'travel' && p.start_date >= today && p.start_date <= in7) {
      const d = daysBetween(today, p.start_date);
      upcomingTravel.push({
        id: `travel-${p.id}`,
        kind: 'travel_departure',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `Travelling to ${p.destination ?? 'their destination'}`,
        dateLabel: `Departs ${fmt(p.start_date)}`,
        status: relativeStatus(d),
        actionLabel: 'View policy',
        href: `/policies/${p.id}`,
        tone: 'info',
        draft: {
          phone: phoneOf(p.clients),
          policyId: p.id,
          message: buildDraftMessage('travel_departure', {
            clientFirstName: firstNameOf(nameOf(p.clients)),
            policyLabel: 'Travel',
            dateText: fmt(p.start_date),
            destination: p.destination,
          }),
        },
      });
    }
  }

  // --- 5. Upcoming Renewals: within 30 days (excludes the <14 already in follow-up) ---
  const upcomingRenewals: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date > in14 && p.renewal_date <= in30) {
      const d = daysBetween(today, p.renewal_date);
      upcomingRenewals.push({
        id: `renewal-${p.id}`,
        kind: 'upcoming_renewal',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `${POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? 'Policy'} renewal coming up`,
        dateLabel: `Renews ${fmt(p.renewal_date)}`,
        status: relativeStatus(d),
        actionLabel: 'View policy',
        href: `/policies/${p.id}`,
        tone: 'neutral',
        draft: renewalDraft(p, false),
      });
    }
  }

  // --- Recent activity: the assistant reports what HAPPENED, not just what's due.
  const recentActivity: TodayItem[] = reminders
    .filter((r) => r.status === 'sent')
    .sort((a, b) => (b.scheduled_at < a.scheduled_at ? -1 : 1))
    .slice(0, 5)
    .map((r) => {
      const isWa = r.message_type === 'manual';
      const kindLabel = isWa
        ? 'WhatsApp message sent'
        : `${draftKindForMessageType(r.message_type)?.replace('_', ' ') ?? r.message_type} reminder sent`;
      return {
        id: `recent-${r.id}`,
        kind: 'recent_activity' as const,
        clientId: r.client_id,
        clientName: nameOf(r.clients),
        reason: kindLabel,
        dateLabel: fmt(r.scheduled_at.slice(0, 10)),
        actionLabel: 'View',
        href: r.policy_id ? `/policies/${r.policy_id}` : `/clients/${r.client_id}`,
        tone: 'neutral' as const,
        status: 'sent',
        draft: null,
      };
    });

  // --- Birthdays this week: computed LIVE from client records (no reminder
  // rows needed — birthdays recur; the reminder engine handles policy events).
  type BirthdayClient = { id: string; full_name: string; phone_number: string | null; birthday: string | null; created_at: string };
  const birthdays: TodayItem[] = ((birthdayClientsRes.data ?? []) as unknown as BirthdayClient[])
    .filter((c) => c.birthday != null)
    .map((c) => ({ c, days: daysUntilBirthday(c.birthday as string, today) }))
    .filter(({ days }) => days >= 0 && days <= 6)
    .sort((a, b) => a.days - b.days)
    .map(({ c, days }) => {
      const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : fmt(nextBirthdayDate(c.birthday as string, today));
      return {
        id: `bday-${c.id}`,
        kind: 'birthday' as const,
        clientId: c.id,
        clientName: c.full_name,
        reason: days === 0 ? 'Birthday today — send your wishes' : 'Birthday coming up',
        dateLabel: when,
        actionLabel: 'View client',
        href: `/clients/${c.id}`,
        tone: (days === 0 ? 'info' : 'neutral') as TodayTone,
        status: days === 0 ? 'Today' : `In ${days} day${days === 1 ? '' : 's'}`,
        draft: c.phone_number
          ? {
              phone: c.phone_number,
              policyId: null,
              message: buildDraftMessage('birthday', {
                clientFirstName: firstNameOf(c.full_name),
                policyLabel: '',
                dateText: '',
              }),
            }
          : { phone: null, policyId: null, message: buildDraftMessage('birthday', { clientFirstName: firstNameOf(c.full_name), policyLabel: '', dateText: '' }) },
      };
    });

  // --- Gone quiet: relationships drifting toward churn. Last-contact from the
  // full sent ledger; new clients get a 30-day grace period. Capped at 5 rows.
  const lastContactByClient = new Map<string, string>();
  // Ground truth: logged interactions count as contact too (empty pre-0007).
  const interactionsRes = await supabase.from('interactions').select('client_id, occurred_at');
  for (const i of interactionsRes.data ?? []) {
    const d = (i.occurred_at as string).slice(0, 10);
    const prev = lastContactByClient.get(i.client_id as string);
    if (!prev || d > prev) lastContactByClient.set(i.client_id as string, d);
  }
  for (const m of sentHistoryRes.data ?? []) {
    const d = (m.scheduled_at as string).slice(0, 10);
    const prev = lastContactByClient.get(m.client_id as string);
    if (!prev || d > prev) lastContactByClient.set(m.client_id as string, d);
  }
  const goneQuiet: TodayItem[] = ((birthdayClientsRes.data ?? []) as unknown as BirthdayClient[])
    .map((c) => {
      const last = lastContactByClient.get(c.id) ?? null;
      return { c, last, cls: classifyQuiet(last, c.created_at.slice(0, 10), today) };
    })
    .filter(({ cls }) => cls === 'never' || cls === 'quiet')
    .sort((a, b) => (a.last ?? '0') < (b.last ?? '0') ? -1 : 1)
    .slice(0, 5)
    .map(({ c, last }) => ({
      id: `quiet-${c.id}`,
      kind: 'gone_quiet' as const,
      clientId: c.id,
      clientName: c.full_name,
      reason: last ? `No contact since ${fmt(last)}` : 'No contact ever logged',
      dateLabel: last ? fmt(last) : '—',
      actionLabel: 'View client',
      href: `/clients/${c.id}`,
      tone: 'warning' as TodayTone,
      status: last ? 'Quiet' : 'Never',
      draft: {
        phone: c.phone_number,
        policyId: null,
        message: buildDraftMessage('checkin', { clientFirstName: firstNameOf(c.full_name), policyLabel: '', dateText: '' }),
      },
    }));

  // --- Morning briefing: the executive-assistant layer.
  const DAYMS = 86400000;
  const dEx = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAYMS);
  const portfolioByClient = new Map<string, PortfolioClient>();
  for (const c of (birthdayClientsRes.data ?? []) as unknown as BirthdayClient[]) {
    portfolioByClient.set(c.id, {
      id: c.id,
      name: c.full_name,
      birthdayInDays: c.birthday ? daysUntilBirthday(c.birthday, today) : null,
      lastContact: lastContactByClient.get(c.id) ?? null,
      clientSince: c.created_at.slice(0, 10),
      annualValue: 0,
      coverageTypes: [],
      overduePolicies: [],
      upcomingPolicies: [],
    });
  }
  for (const p of policiesRes.data ?? []) {
    const pc = portfolioByClient.get(p.client_id as string);
    if (!pc || p.status !== 'active') continue;
    const annual = annualizedPremium(p.payment_mode as string | null, p.premium_amount as number | null);
    pc.annualValue += annual;
    pc.coverageTypes.push(p.policy_type as string);
    const label = POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? (p.policy_type as string);
    const renewal = p.renewal_date as string | null;
    if (renewal) {
      const d = dEx(today, renewal);
      if (d < 0) pc.overduePolicies.push({ label, renewalDate: renewal, annualized: annual });
      else if (d <= 45) pc.upcomingPolicies.push({ label, renewalDate: renewal, daysAway: d, annualized: annual });
    }
  }
  const briefing = buildBriefing({ today, clients: [...portfolioByClient.values()] });

  // stats
  const renewalsThisMonth = policies.filter(
    (p) => p.policy_type !== 'travel' && p.renewal_date && p.renewal_date >= today && p.renewal_date < monthEnd,
  ).length;
  const remindersPending = reminders.filter((r) => r.status === 'pending').length;

  const sections: TodaySection[] = [
    { key: 'attention', title: 'Needs attention', emoji: '', items: needsAttention },
    { key: 'birthdays', title: 'Birthdays this week', emoji: '', items: birthdays },
    { key: 'scheduled', title: "Today's schedule", emoji: '', items: scheduledToday },
    { key: 'renewals', title: 'Upcoming renewals', emoji: '', items: upcomingRenewals },
    { key: 'followup', title: 'Follow-ups', emoji: '', items: followUp },
    { key: 'quiet', title: 'Gone quiet', emoji: '', items: goneQuiet },
    { key: 'travel', title: 'Upcoming travel', emoji: '', items: upcomingTravel },
    { key: 'recent', title: 'Recent activity', emoji: '', items: recentActivity },
  ];

  return {
    briefing,
    agentName,
    stats: {
      clients: clientsRes.count ?? 0,
      activePolicies: policies.length,
      renewalsThisMonth,
      remindersPending,
    },
    summary: {
      urgent: needsAttention.length,
      followUps: followUp.length,
      scheduledToday: scheduledToday.length,
    },
    sections,
  };
}

function labelReminder(t: string): string {
  switch (t) {
    case 'travel_departure': return 'Bon voyage message goes out';
    case 'travel_return': return 'Welcome-home message goes out';
    case 'renewal_60': return 'Renewal reminder (60 days) goes out';
    case 'renewal_30': return 'Renewal reminder (30 days) goes out';
    case 'renewal_7': return 'Renewal reminder (7 days) goes out';
    case 'premium_due': return 'Premium due reminder goes out';
    case 'anniversary': return 'Policy anniversary message goes out';
    default: return 'Scheduled message goes out';
  }
}
