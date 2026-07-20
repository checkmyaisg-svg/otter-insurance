import { daysUntilBirthday } from '../dates/birthday';

/**
 * PROSPEKT INTELLIGENCE ENGINE — module 1: deterministic relationship reasoning.
 *
 * Design contract (docs/design-system-v2.md → Intelligence addendum):
 *  - INPUT is a fully-materialized ClientContext (data layer owns fetching).
 *  - Every conclusion carries its evidence (`reasons`/`basis`) — nothing is
 *    asserted that cannot be traced to a field in the context. No fabricated
 *    percentages, no invented dollars: estimates derive from the client's own
 *    premium data and say so.
 *  - Pure functions throughout: trivially testable, zero latency, zero cost.
 *  - Future modules (LLM narration, renewal prediction, life-event detection)
 *    implement the same (ctx) -> section contract and slot into buildReport.
 */

export interface PolicyCtx {
  id: string;
  type: string;
  label: string;
  insurer: string | null;
  status: string;
  startDate: string | null;
  renewalDate: string | null;
  premiumAmount: number | null;
  paymentMode: string | null;
  sumAssured: number | null;
}

export interface MessageCtx {
  type: string;
  status: string; // pending | sent | failed
  date: string; // YYYY-MM-DD
  isWaDraft: boolean;
}

export interface InteractionCtx {
  type: string;
  date: string; // YYYY-MM-DD
  note: string | null;
}

export interface ClientContext {
  today: string; // YYYY-MM-DD (SG)
  name: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  clientSince: string; // YYYY-MM-DD
  occupation: string | null;
  dependants: number | null;
  policies: PolicyCtx[];
  messages: MessageCtx[];
  interactions: InteractionCtx[];
}

const DAY = 86400000;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// ---------- shared signals ----------

export interface Signals {
  activePolicies: PolicyCtx[];
  coverageTypes: Set<string>;
  yearsAsClient: number;
  lastContactDate: string | null;
  daysSinceContact: number | null; // null = never contacted
  sentCount: number;
  waDraftCount: number;
  failedCount: number;
  overdueRenewals: PolicyCtx[];
  upcomingRenewals: PolicyCtx[]; // within 45 days
  birthdayInDays: number | null;
  avgPremium: number | null; // across active policies with premium data
  annualRenewalValue: number; // sum of premiums on policies renewing ≤ 90 days
}

export function computeSignals(ctx: ClientContext): Signals {
  const active = ctx.policies.filter((p) => p.status === 'active');
  const sent = ctx.messages.filter((m) => m.status === 'sent');
  // Ground truth: contact = sent messages ∪ logged interactions.
  const contactDates = [...sent.map((m) => m.date), ...ctx.interactions.map((i) => i.date)].sort();
  const lastContactDate = contactDates.at(-1) ?? null;
  const overdue = active.filter(
    (p) => p.renewalDate && daysBetween(ctx.today, p.renewalDate) < 0,
  );
  const upcoming = active.filter((p) => {
    if (!p.renewalDate) return false;
    const d = daysBetween(ctx.today, p.renewalDate);
    return d >= 0 && d <= 45;
  });
  const premiums = active
    .map((p) => p.premiumAmount)
    .filter((x): x is number => x != null && x > 0);
  const renewalValue = active
    .filter((p) => p.renewalDate && Math.abs(daysBetween(ctx.today, p.renewalDate)) <= 90)
    .map((p) => p.premiumAmount ?? 0)
    .reduce((a, b) => a + b, 0);
  return {
    activePolicies: active,
    coverageTypes: new Set(active.map((p) => p.type)),
    yearsAsClient: Math.max(0, Math.floor(daysBetween(ctx.clientSince, ctx.today) / 365)),
    lastContactDate,
    daysSinceContact: lastContactDate ? daysBetween(lastContactDate, ctx.today) : null,
    sentCount: sent.length,
    waDraftCount: sent.filter((m) => m.isWaDraft).length,
    failedCount: ctx.messages.filter((m) => m.status === 'failed').length,
    overdueRenewals: overdue,
    upcomingRenewals: upcoming,
    birthdayInDays: ctx.birthday ? daysUntilBirthday(ctx.birthday, ctx.today) : null,
    avgPremium: premiums.length ? premiums.reduce((a, b) => a + b, 0) / premiums.length : null,
    annualRenewalValue: renewalValue,
  };
}

// ---------- renewal risk ----------

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'none';
  score: number; // 0-100, transparent weighted sum — NOT a fake "confidence"
  reasons: string[];
}

export function assessRenewalRisk(ctx: ClientContext, s: Signals): RiskAssessment {
  if (s.overdueRenewals.length === 0 && s.upcomingRenewals.length === 0) {
    return { level: 'none', score: 0, reasons: ['No renewals due in the next 45 days.'] };
  }
  let score = 0;
  const reasons: string[] = [];
  for (const p of s.overdueRenewals) {
    const d = -daysBetween(ctx.today, p.renewalDate!);
    score += Math.min(50, 25 + d / 2);
    reasons.push(`${p.label} renewal is ${d} day${d === 1 ? '' : 's'} overdue.`);
  }
  for (const p of s.upcomingRenewals) {
    const d = daysBetween(ctx.today, p.renewalDate!);
    score += Math.max(5, 25 - d / 2);
    reasons.push(`${p.label} renewal due in ${d} day${d === 1 ? '' : 's'}.`);
  }
  if (s.daysSinceContact === null) {
    score += 25;
    reasons.push('No contact has ever been logged with this client.');
  } else if (s.daysSinceContact > 60) {
    score += 20;
    reasons.push(`Last contact was ${s.daysSinceContact} days ago.`);
  } else if (s.daysSinceContact > 30) {
    score += 10;
    reasons.push(`Last contact was ${s.daysSinceContact} days ago.`);
  } else {
    reasons.push(`Recent contact ${s.daysSinceContact} day${s.daysSinceContact === 1 ? '' : 's'} ago lowers risk.`);
  }
  if (s.failedCount > 0) {
    score += 10;
    reasons.push(`${s.failedCount} message${s.failedCount === 1 ? '' : 's'} previously failed to send.`);
  }
  score = Math.min(100, Math.round(score));
  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { level, score, reasons };
}

// ---------- relationship health ----------

export interface HealthComponent { key: string; label: string; score: number; basis: string }
export interface HealthScore { overall: number; components: HealthComponent[] }

export function scoreHealth(ctx: ClientContext, s: Signals): HealthScore {
  const recency: HealthComponent = (() => {
    if (s.daysSinceContact === null)
      return { key: 'recency', label: 'Contact recency', score: 10, basis: 'Never contacted through Prospekt.' };
    const sc = s.daysSinceContact <= 14 ? 95 : s.daysSinceContact <= 30 ? 80 : s.daysSinceContact <= 60 ? 55 : s.daysSinceContact <= 90 ? 35 : 15;
    return { key: 'recency', label: 'Contact recency', score: sc, basis: `Last contact ${s.daysSinceContact} days ago.` };
  })();

  const CORE = ['life', 'health', 'ci', 'car', 'home'];
  const covered = CORE.filter((t) => s.coverageTypes.has(t));
  const coverage: HealthComponent = {
    key: 'coverage',
    label: 'Coverage breadth',
    score: Math.round((covered.length / CORE.length) * 100),
    basis: covered.length
      ? `Covers ${covered.length} of ${CORE.length} core areas (${covered.join(', ')}).`
      : 'No active core coverage on record.',
  };

  const engagement: HealthComponent = (() => {
    const sc = Math.min(100, s.sentCount * 12 + s.waDraftCount * 15);
    return {
      key: 'engagement',
      label: 'Engagement',
      score: sc,
      basis: `${s.sentCount} message${s.sentCount === 1 ? '' : 's'} sent, ${s.waDraftCount} personal WhatsApp${s.waDraftCount === 1 ? '' : 's'}.`,
    };
  })();

  const completeness: HealthComponent = (() => {
    const fields = [ctx.birthday, ctx.email, ctx.notes && ctx.notes.trim() ? ctx.notes : null, ctx.phone];
    const have = fields.filter(Boolean).length;
    return {
      key: 'completeness',
      label: 'Profile completeness',
      score: Math.round((have / fields.length) * 100),
      basis: `${have} of ${fields.length} profile fields filled (phone, email, birthday, notes).`,
    };
  })();

  const components = [recency, coverage, engagement, completeness];
  const overall = Math.round(components.reduce((a, c) => a + c.score, 0) / components.length);
  return { overall, components };
}

// ---------- opportunity engine ----------

export interface Opportunity {
  key: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  revenueBasis: string; // traceable, from THIS client's own premium data
}

export function detectOpportunities(ctx: ClientContext, s: Signals): Opportunity[] {
  const ops: Opportunity[] = [];
  const anchor =
    s.avgPremium != null
      ? `Based on this client's average premium of S$${s.avgPremium.toFixed(0)}/period, a comparable plan is a realistic budget fit.`
      : 'No premium data on file yet — add premiums to unlock revenue sizing.';

  const has = (t: string) => s.coverageTypes.has(t);
  if (!has('health') && s.activePolicies.length > 0)
    ops.push({
      key: 'health',
      title: 'Hospital / health coverage gap',
      confidence: 'high',
      reasoning: `Holds ${s.activePolicies.length} active polic${s.activePolicies.length === 1 ? 'y' : 'ies'} but no health plan on record — the most common and most consequential gap.`,
      revenueBasis: anchor,
    });
  if (!has('ci') && (has('life') || has('health')))
    ops.push({
      key: 'ci',
      title: 'Critical illness rider or standalone',
      confidence: 'medium',
      reasoning: 'Has protection coverage but no CI on record; CI conversations pair naturally with existing life/health reviews.',
      revenueBasis: anchor,
    });
  if (!has('life') && s.activePolicies.length > 0)
    ops.push({
      key: 'life',
      title: 'Life coverage gap',
      confidence: ctx.dependants && ctx.dependants > 0 ? 'high' : 'medium',
      reasoning:
        ctx.dependants && ctx.dependants > 0
          ? `${ctx.dependants} dependant${ctx.dependants === 1 ? '' : 's'} on record with no life coverage — the clearest protection gap there is.`
          : 'Active client with no life policy on record.',
      revenueBasis: anchor,
    });
  if (has('car') && !has('home'))
    ops.push({
      key: 'home',
      title: 'Home contents / fire coverage',
      confidence: 'low',
      reasoning: 'Car owner with no home coverage on record — a low-pressure add-on conversation.',
      revenueBasis: anchor,
    });
  if (s.birthdayInDays != null && s.birthdayInDays <= 30)
    ops.push({
      key: 'review',
      title: 'Birthday coverage review',
      confidence: 'high',
      reasoning: `Birthday in ${s.birthdayInDays} day${s.birthdayInDays === 1 ? '' : 's'} — age changes affect premiums and insurability; the natural review moment.`,
      revenueBasis: 'Review conversations convert existing goodwill; value depends on gaps above.',
    });
  return ops;
}

// ---------- alerts ----------

export interface Alert { severity: 'urgent' | 'notice'; text: string }

export function buildAlerts(ctx: ClientContext, s: Signals): Alert[] {
  const alerts: Alert[] = [];
  for (const p of s.overdueRenewals)
    alerts.push({ severity: 'urgent', text: `${p.label} renewal overdue since ${p.renewalDate}.` });
  if (s.daysSinceContact === null && s.activePolicies.length > 0)
    alerts.push({ severity: 'urgent', text: 'No contact ever logged — this relationship exists only on paper.' });
  else if (s.daysSinceContact != null && s.daysSinceContact >= 90)
    alerts.push({ severity: 'urgent', text: `No contact for ${s.daysSinceContact} days.` });
  for (const p of s.upcomingRenewals)
    alerts.push({ severity: 'notice', text: `${p.label} renewal approaching (${p.renewalDate}).` });
  if (s.birthdayInDays != null && s.birthdayInDays <= 7)
    alerts.push({
      severity: 'notice',
      text: s.birthdayInDays === 0 ? 'Birthday is today.' : `Birthday in ${s.birthdayInDays} day${s.birthdayInDays === 1 ? '' : 's'}.`,
    });
  if (s.failedCount > 0)
    alerts.push({ severity: 'notice', text: `${s.failedCount} scheduled message${s.failedCount === 1 ? '' : 's'} failed to send.` });
  return alerts;
}

// ---------- narrative + next best action ----------

export function buildSummary(ctx: ClientContext, s: Signals): string[] {
  const lines: string[] = [];
  const tenure =
    s.yearsAsClient >= 1
      ? `${ctx.name} has been your client for ${s.yearsAsClient} year${s.yearsAsClient === 1 ? '' : 's'}.`
      : `${ctx.name} became your client on ${ctx.clientSince}.`;
  lines.push(tenure);
  if (ctx.occupation)
    lines.push(`Works as ${ctx.occupation}${ctx.dependants && ctx.dependants > 0 ? `, with ${ctx.dependants} dependant${ctx.dependants === 1 ? '' : 's'}` : ''}.`);
  else if (ctx.dependants && ctx.dependants > 0)
    lines.push(`Has ${ctx.dependants} dependant${ctx.dependants === 1 ? '' : 's'} on record.`);
  if (s.activePolicies.length > 0) {
    const labels = [...new Set(s.activePolicies.map((p) => p.label))];
    lines.push(`Holds ${s.activePolicies.length} active polic${s.activePolicies.length === 1 ? 'y' : 'ies'}: ${labels.join(', ')}.`);
  } else {
    lines.push('Has no active policies on record.');
  }
  lines.push(
    s.daysSinceContact === null
      ? 'No outreach has been logged yet through Prospekt.'
      : `Last contact was ${s.daysSinceContact} day${s.daysSinceContact === 1 ? '' : 's'} ago${s.waDraftCount > 0 ? `, including ${s.waDraftCount} personal WhatsApp message${s.waDraftCount === 1 ? '' : 's'}` : ''}.`,
  );
  if (s.overdueRenewals.length > 0)
    lines.push(`⚠ ${s.overdueRenewals.map((p) => p.label).join(' and ')} renewal${s.overdueRenewals.length === 1 ? ' is' : 's are'} overdue.`);
  else if (s.upcomingRenewals.length > 0)
    lines.push(`${s.upcomingRenewals.map((p) => p.label).join(' and ')} renew${s.upcomingRenewals.length === 1 ? 's' : ''} within 45 days.`);
  return lines;
}

export interface NextAction { text: string; reasons: string[] }

export function nextBestAction(ctx: ClientContext, s: Signals): NextAction {
  if (s.overdueRenewals.length > 0) {
    const p = s.overdueRenewals[0]!;
    return {
      text: `Contact ${ctx.firstName} today about the overdue ${p.label.toLowerCase()} renewal — every extra day risks losing it.`,
      reasons: [`${p.label} renewal date ${p.renewalDate} has passed.`, 'Overdue renewals are the highest-value save available.'],
    };
  }
  if (s.upcomingRenewals.length > 0) {
    const p = s.upcomingRenewals[0]!;
    const d = daysBetween(ctx.today, p.renewalDate!);
    return {
      text: `Reach out within ${Math.min(3, d)} day${Math.min(3, d) === 1 ? '' : 's'} to secure the ${p.label.toLowerCase()} renewal (due in ${d} days).`,
      reasons: [`Renewal on ${p.renewalDate}.`, 'Early contact converts renewals before competitors call.'],
    };
  }
  if (s.birthdayInDays != null && s.birthdayInDays <= 7)
    return {
      text: `Send ${ctx.firstName} birthday wishes${s.birthdayInDays === 0 ? ' today' : ` (birthday in ${s.birthdayInDays} day${s.birthdayInDays === 1 ? '' : 's'})`} — the draft is one tap away.`,
      reasons: ['Birthday inside 7 days.', 'Birthday touchpoints open natural review conversations.'],
    };
  if (s.daysSinceContact === null || s.daysSinceContact >= 60)
    return {
      text: `Send a light check-in — ${s.daysSinceContact === null ? 'no contact has ever been logged' : `it has been ${s.daysSinceContact} days`}.`,
      reasons: ['Long silence precedes churn and poaching.', 'A no-agenda message maintains the relationship cheaply.'],
    };
  return {
    text: 'Nothing urgent — relationship is current. Optional: review the opportunities below.',
    reasons: [`Last contact ${s.daysSinceContact} day${s.daysSinceContact === 1 ? '' : 's'} ago; no renewals inside 45 days.`],
  };
}

// ---------- report ----------

export interface IntelligenceReport {
  summary: string[];
  nextAction: NextAction;
  risk: RiskAssessment;
  health: HealthScore;
  opportunities: Opportunity[];
  alerts: Alert[];
  renewalValue: number;
  renewalValueBasis: string;
}

export function buildReport(ctx: ClientContext): IntelligenceReport {
  const s = computeSignals(ctx);
  return {
    summary: buildSummary(ctx, s),
    nextAction: nextBestAction(ctx, s),
    risk: assessRenewalRisk(ctx, s),
    health: scoreHealth(ctx, s),
    opportunities: detectOpportunities(ctx, s),
    alerts: buildAlerts(ctx, s),
    renewalValue: s.annualRenewalValue,
    renewalValueBasis:
      s.annualRenewalValue > 0
        ? 'Sum of recorded premiums on policies renewing within ±90 days.'
        : 'No premiums recorded on near-term renewals.',
  };
}
