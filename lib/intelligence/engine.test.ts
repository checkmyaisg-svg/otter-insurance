import { describe, it, expect } from 'vitest';
import {
  buildReport,
  computeSignals,
  assessRenewalRisk,
  detectOpportunities,
  type ClientContext,
} from './engine';

const base: ClientContext = {
  today: '2026-07-19',
  name: 'Tan Wei Ming',
  firstName: 'Wei Ming',
  phone: '+6581031668',
  email: 'wm@example.com',
  birthday: '1988-07-22',
  notes: 'Prefers evening calls',
  clientSince: '2022-03-10',
  occupation: null,
  dependants: null,
  interactions: [],
  policies: [
    { id: 'p1', type: 'car', label: 'Car', insurer: 'NTUC', status: 'active', startDate: '2025-06-10', renewalDate: '2026-06-10', premiumAmount: 1200, paymentMode: 'annual', sumAssured: null },
    { id: 'p2', type: 'life', label: 'Life', insurer: 'AIA', status: 'active', startDate: '2022-03-15', renewalDate: null, premiumAmount: 250.5, paymentMode: 'monthly', sumAssured: 500000 },
  ],
  messages: [
    { type: 'renewal_30', status: 'sent', date: '2026-06-06', isWaDraft: false },
    { type: 'manual', status: 'sent', date: '2026-06-06', isWaDraft: true },
  ],
};

describe('intelligence engine', () => {
  it('signals: overdue detection, contact recency, renewal value from real premiums', () => {
    const s = computeSignals(base);
    expect(s.overdueRenewals.map((p) => p.id)).toEqual(['p1']);
    expect(s.daysSinceContact).toBe(43);
    expect(s.annualRenewalValue).toBe(1200); // only the renewing policy's real premium
    expect(s.birthdayInDays).toBe(3);
  });

  it('risk: overdue + 43-day silence lands medium/high with traceable reasons', () => {
    const s = computeSignals(base);
    const r = assessRenewalRisk(base, s);
    expect(['medium', 'high']).toContain(r.level);
    expect(r.reasons.join(' ')).toContain('overdue');
    expect(r.reasons.join(' ')).toContain('39 days overdue');
  });

  it('opportunities: health gap flagged high with premium-anchored basis; no fabricated dollars', () => {
    const ops = detectOpportunities(base, computeSignals(base));
    const health = ops.find((o) => o.key === 'health');
    expect(health?.confidence).toBe('high');
    expect(health?.revenueBasis).toContain('average premium');
    // birthday review fires (3 days out)
    expect(ops.some((o) => o.key === 'review')).toBe(true);
  });

  it('report: full assembly, next action targets the overdue renewal', () => {
    const rep = buildReport(base);
    expect(rep.nextAction.text.toLowerCase()).toContain('overdue');
    expect(rep.summary.length).toBeGreaterThanOrEqual(3);
    expect(rep.health.overall).toBeGreaterThan(0);
    expect(rep.alerts.some((a) => a.severity === 'urgent')).toBe(true);
  });

  it('quiet healthy client: none-risk, calm next action', () => {
    const calm: ClientContext = {
      ...base,
      birthday: null, // no birthday hook — the engine correctly prioritizes one otherwise
      policies: [{ ...base.policies[1]! }],
      messages: [{ type: 'manual', status: 'sent', date: '2026-07-15', isWaDraft: true }],
    };
    const rep = buildReport(calm);
    expect(rep.risk.level).toBe('none');
    expect(rep.nextAction.text).toContain('Nothing urgent');
  });
});

import { annualizedPremium, classifyQuiet } from './portfolio';

describe('portfolio math', () => {
  it('annualizes premiums by payment mode; single & unknown excluded', () => {
    expect(annualizedPremium('monthly', 250.5)).toBeCloseTo(3006);
    expect(annualizedPremium('semi_annual', 600)).toBe(1200);
    expect(annualizedPremium('annual', 1200)).toBe(1200);
    expect(annualizedPremium('single', 50000)).toBe(0);
    expect(annualizedPremium(null, 100)).toBe(0);
    expect(annualizedPremium('monthly', null)).toBe(0);
  });
  it('classifies quiet clients with a new-client grace period', () => {
    expect(classifyQuiet(null, '2026-07-01', '2026-07-19')).toBe('new');
    expect(classifyQuiet(null, '2026-01-01', '2026-07-19')).toBe('never');
    expect(classifyQuiet('2026-04-01', '2025-01-01', '2026-07-19')).toBe('quiet');
    expect(classifyQuiet('2026-07-01', '2025-01-01', '2026-07-19')).toBe('ok');
  });
});

import { buildBriefing, type PortfolioContext } from './briefing';

describe('morning briefing', () => {
  const pctx: PortfolioContext = {
    today: '2026-07-19',
    clients: [
      { id: 'c1', name: 'Tan Wei Ming', birthdayInDays: 3, lastContact: '2026-05-01', clientSince: '2022-01-01', annualValue: 4200, coverageTypes: ['car', 'life'], overduePolicies: [{ label: 'Car', renewalDate: '2026-06-10', annualized: 1200 }], upcomingPolicies: [] },
      { id: 'c2', name: 'Lim Hui Wen', birthdayInDays: null, lastContact: null, clientSince: '2025-01-01', annualValue: 6000, coverageTypes: ['life'], overduePolicies: [], upcomingPolicies: [] },
      { id: 'c3', name: 'Sarah Chan', birthdayInDays: null, lastContact: '2026-07-15', clientSince: '2024-01-01', annualValue: 900, coverageTypes: ['health'], overduePolicies: [], upcomingPolicies: [{ label: 'Health', renewalDate: '2026-08-15', daysAway: 27, annualized: 900 }] },
    ],
  };

  it('surfaces overdue value with SGD from real premiums', () => {
    const b = buildBriefing(pctx);
    const overdue = b.insights.find((i) => i.key === 'overdue-value');
    expect(overdue?.valueAtStake).toBe(1200);
    expect(overdue?.headline).toContain('S$1,200');
  });

  it('flags neglected top-value clients with combined book value', () => {
    const b = buildBriefing(pctx);
    const neg = b.insights.find((i) => i.key === 'neglected-top');
    expect(neg).toBeTruthy();
    expect(neg!.clients.map((c) => c.name)).toContain('Lim Hui Wen'); // never contacted, top value
  });

  it('detects birthday x coverage-gap coincidence', () => {
    const b = buildBriefing(pctx);
    const bd = b.insights.find((i) => i.key === 'birthday-opportunity');
    expect(bd?.clients[0]?.name).toBe('Tan Wei Ming'); // birthday in 3d, no health
  });

  it('focus list: ranked, deduped, overdue-value first, capped at 4', () => {
    const b = buildBriefing(pctx);
    expect(b.focus.length).toBeLessThanOrEqual(4);
    expect(b.focus[0]?.clientName).toBe('Tan Wei Ming'); // overdue outranks all
    const ids = b.focus.map((f) => f.clientId);
    expect(new Set(ids).size).toBe(ids.length); // deduped
  });

  it('healthy portfolio gets an explicit all-clear, not silence', () => {
    const calm = buildBriefing({ today: '2026-07-19', clients: [{ id: 'c9', name: 'Ok Client', birthdayInDays: null, lastContact: '2026-07-18', clientSince: '2024-01-01', annualValue: 1000, coverageTypes: ['life', 'health'], overduePolicies: [], upcomingPolicies: [] }] });
    expect(calm.insights[0]?.key).toBe('all-clear');
  });
});

import { classify, nameHintFrom } from '../copilot/intents';

describe('copilot intent router', () => {
  it('routes the canonical questions', () => {
    expect(classify('Who should I call today?').kind).toBe('focus');
    expect(classify('Which renewals are at risk?').kind).toBe('at_risk_renewals');
    expect(classify('Which clients have birthdays this week?').kind).toBe('birthdays');
    expect(classify('Show clients with dependants but no life coverage').kind).toBe('dependants_no_life');
    expect(classify("Summarise today's Morning Briefing").kind).toBe('briefing');
    expect(classify('Why is Tan Wei Ming considered high risk?').kind).toBe('client_why');
    expect(classify('Draft a WhatsApp for Sarah about her upcoming renewal').kind).toBe('draft');
    expect(classify('What opportunities am I missing?').kind).toBe('opportunities');
    expect(classify('How much revenue is at risk?').kind).toBe('revenue_at_risk');
    expect(classify("Who haven't I spoken to in 90 days?").kind).toBe('quiet');
  });
  it('extracts name hints', () => {
    expect(nameHintFrom('Why is Tan Wei Ming considered high risk?')).toBe('Tan Wei Ming');
    expect(nameHintFrom('Draft a WhatsApp for Sarah about her renewal')).toContain('Sarah');
  });
  it('unknown questions fall to help, never to a wrong engine', () => {
    expect(classify('what is the weather').kind).toBe('help');
  });
});

import { rollRenewalForward } from '../dates/renewal';

describe('renewal outcomes', () => {
  it('rolls renewal forward one year, handling 29 Feb', () => {
    expect(rollRenewalForward('2026-06-10')).toBe('2027-06-10');
    expect(rollRenewalForward('2028-02-29')).toBe('2029-02-28');
    expect(rollRenewalForward('2026-12-31')).toBe('2027-12-31');
  });
});

describe('copilot mark-renewed intent', () => {
  it('routes "mark X renewed" phrasings', () => {
    expect(classify("Mark Tan Wei Ming's renewal done").kind).toBe('mark_renewed');
    expect(classify('mark test zack renewed').kind).toBe('mark_renewed');
  });
});

import { parseLlmIntent, buildClassifierPrompt } from '../copilot/llm';

describe('llm adapter (pure parts)', () => {
  it('parses valid intent JSON, with and without fences', () => {
    expect(parseLlmIntent('{"kind":"quiet","nameHint":null}')).toEqual({ kind: 'quiet' });
    expect(parseLlmIntent('```json\n{"kind":"draft","nameHint":"Sarah Chan"}\n```')).toEqual({ kind: 'draft', nameHint: 'Sarah Chan' });
  });
  it('rejects unknown kinds and malformed replies', () => {
    expect(parseLlmIntent('{"kind":"delete_everything"}')).toBeNull();
    expect(parseLlmIntent('sure! here is my answer')).toBeNull();
  });
  it('prompt includes intents, client names, and the JSON contract', () => {
    const p = buildClassifierPrompt('who needs me', ['Tan Wei Ming']);
    expect(p).toContain('mark_renewed');
    expect(p).toContain('Tan Wei Ming');
    expect(p).toContain('ONLY a JSON object');
  });
});
