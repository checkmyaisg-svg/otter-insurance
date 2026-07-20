import { getAgent } from '@/lib/actions/auth';
import { buildReport, type ClientContext, type IntelligenceReport } from '@/lib/intelligence/engine';
import { POLICY_TYPE_LABEL } from '@/lib/policies/behavior';
import type { PolicyType } from '@/lib/policies/behavior';
import { firstNameOf, buildDraftMessage } from '@/lib/whatsapp/templates';

export interface IntelligenceView {
  report: IntelligenceReport;
  suggestedMessage: { text: string; phone: string | null; policyId: string | null };
}

function sgToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Data layer for the intelligence engine: materializes ClientContext from the
 * same RLS-scoped queries the rest of the app uses, runs the pure engine, and
 * derives the suggested WhatsApp draft from the next-best action (reusing the
 * exact template system the dashboard uses — one wording source of truth).
 */
export async function getClientIntelligence(clientId: string): Promise<IntelligenceView | null> {
  const { supabase, userId } = await getAgent();
  if (!userId) return null;

  const [clientRes, policiesRes, messagesRes, interactionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, phone_number, email, birthday, notes, created_at, occupation, dependants')
      .eq('id', clientId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('policies')
      .select('id, policy_type, insurer, status, start_date, renewal_date, premium_amount, payment_mode, sum_assured')
      .eq('client_id', clientId),
    supabase
      .from('scheduled_messages')
      .select('message_type, status, scheduled_at, template_name')
      .eq('client_id', clientId),
    supabase
      .from('interactions')
      .select('interaction_type, occurred_at, note')
      .eq('client_id', clientId),
  ]);

  let c = clientRes.data as (Record<string, unknown> & { occupation?: string | null; dependants?: number | null }) | null;
  if (!c && clientRes.error) {
    // Pre-0007 fallback: retry without the new columns so the panel keeps
    // working until the migration is applied.
    const retry = await supabase
      .from('clients')
      .select('id, full_name, phone_number, email, birthday, notes, created_at')
      .eq('id', clientId)
      .is('deleted_at', null)
      .single();
    c = retry.data as typeof c;
  }
  if (!c) return null;

  const ctx: ClientContext = {
    today: sgToday(),
    name: c.full_name as string,
    firstName: firstNameOf(c.full_name as string),
    phone: (c.phone_number as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    birthday: (c.birthday as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    clientSince: (c.created_at as string).slice(0, 10),
    occupation: (c.occupation as string | null) ?? null,
    dependants: (c.dependants as number | null) ?? null,
    policies: (policiesRes.data ?? []).map((p) => ({
      id: p.id as string,
      type: p.policy_type as string,
      label: POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? (p.policy_type as string),
      insurer: (p.insurer as string | null) ?? null,
      status: p.status as string,
      startDate: (p.start_date as string | null) ?? null,
      renewalDate: (p.renewal_date as string | null) ?? null,
      premiumAmount: (p.premium_amount as number | null) ?? null,
      paymentMode: (p.payment_mode as string | null) ?? null,
      sumAssured: (p.sum_assured as number | null) ?? null,
    })),
    messages: (messagesRes.data ?? []).map((m) => ({
      type: m.message_type as string,
      status: m.status as string,
      date: (m.scheduled_at as string).slice(0, 10),
      isWaDraft:
        m.message_type === 'manual' && Boolean((m.template_name as string | null)?.startsWith('wa_draft')),
    })),
    interactions: (interactionsRes.data ?? []).map((i) => ({
      type: i.interaction_type as string,
      date: (i.occurred_at as string).slice(0, 10),
      note: (i.note as string | null) ?? null,
    })),
  };

  const report = buildReport(ctx);

  // Suggested WhatsApp: mirror the next-best action with the shared templates.
  const s = report;
  const overdue = ctx.policies.find((p) => s.nextAction.text.toLowerCase().includes('overdue') && p.renewalDate);
  let text: string;
  let policyId: string | null = null;
  if (overdue && s.risk.level !== 'none') {
    text = buildDraftMessage('renewal', {
      clientFirstName: ctx.firstName,
      policyLabel: overdue.label,
      dateText: overdue.renewalDate ?? '',
      insurer: overdue.insurer,
      overdue: s.nextAction.text.toLowerCase().includes('overdue'),
    });
    policyId = overdue.id;
  } else if (s.nextAction.text.toLowerCase().includes('birthday')) {
    text = buildDraftMessage('birthday', { clientFirstName: ctx.firstName, policyLabel: '', dateText: '' });
  } else {
    text = buildDraftMessage('checkin', { clientFirstName: ctx.firstName, policyLabel: '', dateText: '' });
  }

  return { report, suggestedMessage: { text, phone: ctx.phone, policyId } };
}
