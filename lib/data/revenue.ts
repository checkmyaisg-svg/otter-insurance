import { getAgent } from '@/lib/actions/auth';
import { annualizedPremium, classifyQuiet } from '@/lib/intelligence/portfolio';
import { POLICY_TYPE_LABEL } from '@/lib/policies/behavior';
import type { PolicyType, PaymentMode } from '@/lib/policies/behavior';
import { PAYMENT_MODE_LABEL } from '@/lib/policies/behavior';

export interface PipelineRow {
  policyId: string;
  clientId: string;
  clientName: string;
  policyLabel: string;
  renewalDate: string;
  daysAway: number; // negative = overdue
  premiumAmount: number | null;
  premiumLabel: string; // "S$1,200 / annual" or "premium not recorded"
  annualized: number;
  atRisk: boolean;
  riskReason: string | null;
}

export interface RevenueReport {
  bookAnnualValue: number; // sum of annualized recurring premiums, active book
  bookPolicyCount: number;
  bookMissingPremiums: number; // active policies without premium data
  pipeline90: PipelineRow[]; // renewals overdue or within 90 days, soonest first
  pipelineTotal: number; // annualized value in the 90-day window
  atRiskTotal: number; // annualized value on at-risk renewals
}

function sgToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/**
 * REVENUE INTELLIGENCE — the advisor's income, made visible.
 * Every figure is a sum of recorded premiums (annualized by payment mode);
 * "at risk" is renewal + contact-recency logic, with the reason attached.
 * No commission guessing: commission rates aren't on record, so we show the
 * premium value that commissions derive from and say exactly that.
 */
export async function getRevenueReport(): Promise<RevenueReport | null> {
  const { supabase, userId } = await getAgent();
  if (!userId) return null;

  const today = sgToday();
  const [policiesRes, sentRes, clientsRes] = await Promise.all([
    supabase
      .from('policies')
      .select('id, client_id, policy_type, renewal_date, premium_amount, payment_mode, clients(full_name)')
      .eq('status', 'active'),
    supabase.from('scheduled_messages').select('client_id, scheduled_at').eq('status', 'sent'),
    supabase.from('clients').select('id, created_at').is('deleted_at', null),
  ]);

  const lastContact = new Map<string, string>();
  // Ground truth: logged interactions count as contact too (empty pre-0007).
  const interactionsRes = await supabase.from('interactions').select('client_id, occurred_at');
  for (const i of interactionsRes.data ?? []) {
    const d = (i.occurred_at as string).slice(0, 10);
    const prev = lastContact.get(i.client_id as string);
    if (!prev || d > prev) lastContact.set(i.client_id as string, d);
  }
  for (const m of sentRes.data ?? []) {
    const d = (m.scheduled_at as string).slice(0, 10);
    const prev = lastContact.get(m.client_id as string);
    if (!prev || d > prev) lastContact.set(m.client_id as string, d);
  }
  const clientSince = new Map<string, string>();
  for (const c of clientsRes.data ?? []) clientSince.set(c.id as string, (c.created_at as string).slice(0, 10));

  let bookAnnualValue = 0;
  let bookMissingPremiums = 0;
  const pipeline90: PipelineRow[] = [];

  for (const p of policiesRes.data ?? []) {
    const annual = annualizedPremium(p.payment_mode as string | null, p.premium_amount as number | null);
    bookAnnualValue += annual;
    if (p.premium_amount == null) bookMissingPremiums += 1;

    const renewal = p.renewal_date as string | null;
    if (!renewal) continue;
    const d = daysBetween(today, renewal);
    if (d > 90) continue;

    const cid = p.client_id as string;
    const cls = classifyQuiet(lastContact.get(cid) ?? null, clientSince.get(cid) ?? today, today, 60, 30);
    const overdue = d < 0;
    const atRisk = overdue || cls === 'never' || cls === 'quiet';
    const riskReason = overdue
      ? `${-d} day${d === -1 ? '' : 's'} overdue`
      : cls === 'never'
        ? 'client never contacted'
        : cls === 'quiet'
          ? 'no contact in 60+ days'
          : null;

    const mode = p.payment_mode as PaymentMode | null;
    pipeline90.push({
      policyId: p.id as string,
      clientId: cid,
      clientName: ((p.clients as { full_name?: string } | null)?.full_name as string) ?? 'Client',
      policyLabel: POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? (p.policy_type as string),
      renewalDate: renewal,
      daysAway: d,
      premiumAmount: (p.premium_amount as number | null) ?? null,
      premiumLabel:
        p.premium_amount != null && mode
          ? `S$${(p.premium_amount as number).toLocaleString('en-SG')} / ${PAYMENT_MODE_LABEL[mode].toLowerCase()}`
          : 'premium not recorded',
      annualized: annual,
      atRisk,
      riskReason,
    });
  }

  pipeline90.sort((a, b) => a.daysAway - b.daysAway);
  return {
    bookAnnualValue: Math.round(bookAnnualValue),
    bookPolicyCount: (policiesRes.data ?? []).length,
    bookMissingPremiums,
    pipeline90,
    pipelineTotal: Math.round(pipeline90.reduce((a, r) => a + r.annualized, 0)),
    atRiskTotal: Math.round(pipeline90.filter((r) => r.atRisk).reduce((a, r) => a + r.annualized, 0)),
  };
}
