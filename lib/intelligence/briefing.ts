import { annualizedPremium, classifyQuiet } from './portfolio';

/**
 * MORNING BRIEFING ENGINE — the executive-assistant layer.
 *
 * Walks in every morning and says what the advisor didn't ask: where value is
 * being neglected, what money is at stake, which coincidences are
 * opportunities, and what the next hour should be spent on. Pure function
 * over PortfolioContext; every sentence traces to fields; money figures are
 * sums of recorded premiums — "at stake", never "lost" (loss is unknowable).
 *
 * Each insight answers at least one of the four screen questions:
 * what happened / what matters / what should I do / what happens if I don't.
 */

export interface PortfolioClient {
  id: string;
  name: string;
  birthdayInDays: number | null;
  lastContact: string | null;
  clientSince: string;
  annualValue: number; // sum of annualized premiums across active policies
  coverageTypes: string[];
  overduePolicies: { label: string; renewalDate: string; annualized: number }[];
  upcomingPolicies: { label: string; renewalDate: string; daysAway: number; annualized: number }[];
}

export interface PortfolioContext {
  today: string;
  clients: PortfolioClient[];
}

export interface BriefingInsight {
  key: string;
  severity: 'urgent' | 'notice' | 'info';
  headline: string;
  detail: string; // includes the "what happens if I don't"
  valueAtStake: number | null; // SGD, from recorded premiums only
  clients: { id: string; name: string }[];
}

export interface FocusItem {
  clientId: string;
  clientName: string;
  reason: string;
  valueAtStake: number;
}

export interface Briefing {
  insights: BriefingInsight[];
  focus: FocusItem[]; // "spend the next hour on these" — ranked, max 4
}

const sgd = (n: number) => `S$${Math.round(n).toLocaleString('en-SG')}`;

export function buildBriefing(ctx: PortfolioContext): Briefing {
  const insights: BriefingInsight[] = [];
  const focusScored: (FocusItem & { score: number })[] = [];

  // --- 1. Money past due without follow-through (what happens if I don't)
  const overdueClients = ctx.clients.filter((c) => c.overduePolicies.length > 0);
  const overdueValue = overdueClients.reduce(
    (a, c) => a + c.overduePolicies.reduce((x, p) => x + p.annualized, 0),
    0,
  );
  if (overdueClients.length > 0) {
    insights.push({
      key: 'overdue-value',
      severity: 'urgent',
      headline:
        overdueValue > 0
          ? `${sgd(overdueValue)}/year in renewals is past due and unresolved`
          : `${overdueClients.length} renewal${overdueClients.length === 1 ? ' is' : 's are'} past due and unresolved`,
      detail:
        'Every week an overdue renewal sits unanswered, the odds of saving it fall — competitors call these clients too.',
      valueAtStake: overdueValue > 0 ? Math.round(overdueValue) : null,
      clients: overdueClients.map((c) => ({ id: c.id, name: c.name })),
    });
    for (const c of overdueClients) {
      const v = c.overduePolicies.reduce((x, p) => x + p.annualized, 0);
      focusScored.push({
        clientId: c.id,
        clientName: c.name,
        reason: `${c.overduePolicies[0]!.label} renewal overdue`,
        valueAtStake: Math.round(v),
        score: 4_000_000 + v, // tier 4: overdue — act today
      });
    }
  }

  // --- 2. Neglected high-value clients (what matters)
  const valued = ctx.clients.filter((c) => c.annualValue > 0).sort((a, b) => b.annualValue - a.annualValue);
  const topN = valued.slice(0, Math.max(3, Math.ceil(valued.length * 0.2)));
  const neglectedTop = topN.filter((c) => {
    const cls = classifyQuiet(c.lastContact, c.clientSince, ctx.today, 60, 30);
    return cls === 'quiet' || cls === 'never';
  });
  if (neglectedTop.length > 0) {
    const v = neglectedTop.reduce((a, c) => a + c.annualValue, 0);
    insights.push({
      key: 'neglected-top',
      severity: 'urgent',
      headline: `${neglectedTop.length} of your ${topN.length} highest-value clients ${neglectedTop.length === 1 ? 'has' : 'have'} had no contact in 60+ days`,
      detail: `Together they hold ${sgd(v)}/year of your book. Silence at the top of the book is where retention losses start.`,
      valueAtStake: Math.round(v),
      clients: neglectedTop.map((c) => ({ id: c.id, name: c.name })),
    });
    for (const c of neglectedTop) {
      focusScored.push({
        clientId: c.id,
        clientName: c.name,
        reason: `top-value client, quiet 60+ days`,
        valueAtStake: Math.round(c.annualValue),
        score: 2_000_000 + c.annualValue, // tier 2: neglected top value
      });
    }
  }

  // --- 3. Birthday × opportunity coincidences (what should I do)
  const bdayOps = ctx.clients.filter(
    (c) =>
      c.birthdayInDays != null &&
      c.birthdayInDays <= 7 &&
      c.coverageTypes.length > 0 &&
      !c.coverageTypes.includes('health'),
  );
  if (bdayOps.length > 0) {
    insights.push({
      key: 'birthday-opportunity',
      severity: 'notice',
      headline: `${bdayOps.length} birthday${bdayOps.length === 1 ? '' : 's'} this week double${bdayOps.length === 1 ? 's' : ''} as a coverage-review opening`,
      detail:
        'Each is missing hospital coverage — a birthday message that ends with "shall we do a quick review?" converts goodwill into a conversation.',
      valueAtStake: null,
      clients: bdayOps.map((c) => ({ id: c.id, name: c.name })),
    });
    for (const c of bdayOps) {
      focusScored.push({
        clientId: c.id,
        clientName: c.name,
        reason: 'birthday this week + health gap',
        valueAtStake: 0,
        score: 1_000_000 + (7 - (c.birthdayInDays ?? 7)) * 10, // tier 1: birthday opening
      });
    }
  }

  // --- 4. Renewals approaching with silence (what should I do)
  const upcomingQuiet = ctx.clients.filter(
    (c) =>
      c.upcomingPolicies.length > 0 &&
      classifyQuiet(c.lastContact, c.clientSince, ctx.today, 30, 30) !== 'ok',
  );
  if (upcomingQuiet.length > 0) {
    const v = upcomingQuiet.reduce((a, c) => a + c.upcomingPolicies.reduce((x, p) => x + p.annualized, 0), 0);
    insights.push({
      key: 'upcoming-silent',
      severity: 'notice',
      headline: `${upcomingQuiet.length} client${upcomingQuiet.length === 1 ? '' : 's'} renewing soon ${upcomingQuiet.length === 1 ? 'hasn\u2019t' : 'haven\u2019t'} heard from you this month`,
      detail: `${v > 0 ? `${sgd(v)}/year renews within 45 days. ` : ''}Renewals contacted early convert; renewals contacted at the deadline negotiate.`,
      valueAtStake: v > 0 ? Math.round(v) : null,
      clients: upcomingQuiet.map((c) => ({ id: c.id, name: c.name })),
    });
    for (const c of upcomingQuiet) {
      const soonest = [...c.upcomingPolicies].sort((a, b) => a.daysAway - b.daysAway)[0]!;
      focusScored.push({
        clientId: c.id,
        clientName: c.name,
        reason: `${soonest.label} renews in ${soonest.daysAway}d, no recent contact`,
        valueAtStake: Math.round(soonest.annualized),
        score: 3_000_000 + Math.max(0, 45 - soonest.daysAway) * 1000 + soonest.annualized, // tier 3: renewal deadline approaching
      });
    }
  }

  // --- 5. All clear (what happened) — the assistant says so instead of silence
  if (insights.length === 0 && ctx.clients.length > 0) {
    insights.push({
      key: 'all-clear',
      severity: 'info',
      headline: 'Nothing is on fire this morning',
      detail: 'No overdue renewals, no neglected top clients, no silent near-renewals. A good day for outreach you choose, not outreach you owe.',
      valueAtStake: null,
      clients: [],
    });
  }

  // Focus: dedupe by client (highest score wins), rank, cap 4
  const byClient = new Map<string, FocusItem & { score: number }>();
  for (const f of focusScored) {
    const prev = byClient.get(f.clientId);
    if (!prev || f.score > prev.score) byClient.set(f.clientId, f);
  }
  const focus = [...byClient.values()].sort((a, b) => b.score - a.score).slice(0, 4)
    .map(({ score: _score, ...rest }) => rest);

  return { insights, focus };
}

/** Convenience: annualized value of one policy row (re-exported math). */
export { annualizedPremium };
