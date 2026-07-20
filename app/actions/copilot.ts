'use server';

import { getAgent } from '@/lib/actions/auth';
import { classify } from '@/lib/copilot/intents';
import { getToday } from '@/lib/data/dashboard';
import { getRevenueReport } from '@/lib/data/revenue';
import { getClientIntelligence } from '@/lib/data/intelligence';
import { buildDraftMessage, firstNameOf } from '@/lib/whatsapp/templates';
import { markPolicyRenewed } from '@/app/actions/outcomes';
import { classifyWithLlm } from '@/lib/copilot/llm';

/**
 * PROSPEKT COPILOT — orchestration layer. Classifies the question, then
 * COMPOSES the answer from the engines that already know it (briefing,
 * revenue, relationship intelligence, templates). Zero duplicated logic;
 * every figure and reason originates in an engine that traces to data.
 * The response contract mirrors the product spec: answer → reasoning →
 * recommendation → one-click actions.
 */

export interface CopilotItem {
  title: string;
  subtitle: string;
  href: string;
  value?: string; // e.g. "S$1,200"
}

export interface CopilotDraft {
  clientId: string;
  clientName: string;
  phone: string | null;
  policyId: string | null;
  message: string;
}

export interface CopilotResponse {
  answer: string;
  reasoning: string[];
  recommendation: string | null;
  items: CopilotItem[];
  draft: CopilotDraft | null;
}

const sgd = (n: number) => `S$${Math.round(n).toLocaleString('en-SG')}`;

async function resolveClient(
  supabase: Awaited<ReturnType<typeof getAgent>>['supabase'],
  nameHint: string | null,
  question: string,
): Promise<{ id: string; full_name: string; phone_number: string | null } | null> {
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, phone_number')
    .is('deleted_at', null);
  const clients = (data ?? []) as { id: string; full_name: string; phone_number: string | null }[];
  const q = question.toLowerCase();
  // Best match: longest client name that appears in the question (or the hint).
  let best: (typeof clients)[number] | null = null;
  for (const c of clients) {
    const name = c.full_name.toLowerCase();
    const first = name.split(/\s+/)[0] ?? name;
    if (q.includes(name) || (nameHint && name.includes(nameHint.toLowerCase())) || q.includes(first)) {
      if (!best || c.full_name.length > best.full_name.length) best = c;
    }
  }
  return best;
}

export async function askCopilot(question: string): Promise<CopilotResponse> {
  const { supabase, userId } = await getAgent();
  if (!userId)
    return { answer: 'You are not signed in.', reasoning: [], recommendation: null, items: [], draft: null };

  let intent = classify(question);
  if (intent.kind === 'help') {
    // Long-tail phrasing: optional LLM classification (entity-aware, answer-free).
    const { data: names } = await supabase.from('clients').select('full_name').is('deleted_at', null);
    const llmIntent = await classifyWithLlm(question, (names ?? []).map((n) => n.full_name as string));
    if (llmIntent) intent = llmIntent;
  }

  switch (intent.kind) {
    case 'focus': {
      const today = await getToday();
      const focus = today.briefing.focus;
      if (focus.length === 0)
        return {
          answer: 'Nothing demands your hour today — no overdue renewals, silent near-renewals, or neglected top clients.',
          reasoning: ['The Morning Briefing found no deadline-driven or value-driven priorities.'],
          recommendation: 'Use the time for outreach you choose: birthdays and opportunities below the briefing.',
          items: [],
          draft: null,
        };
      return {
        answer: `Spend your next hour on these ${focus.length}:`,
        reasoning: ['Ranked deadline-first (overdue → near-renewal → neglected value → birthday openings), value-sorted within tiers.'],
        recommendation: `Start with ${focus[0]!.clientName} — ${focus[0]!.reason}.`,
        items: focus.map((f) => ({
          title: f.clientName,
          subtitle: f.reason,
          href: `/clients/${f.clientId}`,
          value: f.valueAtStake > 0 ? sgd(f.valueAtStake) : undefined,
        })),
        draft: null,
      };
    }

    case 'at_risk_renewals':
    case 'revenue_at_risk': {
      const r = await getRevenueReport();
      if (!r) return { answer: 'No revenue data available.', reasoning: [], recommendation: null, items: [], draft: null };
      const risky = r.pipeline90.filter((row) => row.atRisk);
      const answer =
        intent.kind === 'revenue_at_risk'
          ? `${sgd(r.atRiskTotal)}/year of renewal value is currently at risk, out of ${sgd(r.pipelineTotal)} renewing within 90 days.`
          : risky.length === 0
            ? 'No renewals are currently flagged at risk in the 90-day pipeline.'
            : `${risky.length} renewal${risky.length === 1 ? ' is' : 's are'} at risk in the next 90 days (${sgd(r.atRiskTotal)}/year).`;
      return {
        answer,
        reasoning: [
          'At-risk = renewal overdue, or client silent 60+ days / never contacted as the renewal approaches.',
          'Values are annualized from recorded premiums — the figures commissions derive from.',
        ],
        recommendation: risky.length > 0 ? `Contact ${risky[0]!.clientName} first — ${risky[0]!.riskReason}.` : null,
        items: risky.slice(0, 6).map((row) => ({
          title: row.clientName,
          subtitle: `${row.policyLabel} · ${row.riskReason ?? 'renewing soon'}`,
          href: `/policies/${row.policyId}`,
          value: row.annualized > 0 ? sgd(row.annualized) : undefined,
        })),
        draft: null,
      };
    }

    case 'birthdays': {
      const today = await getToday();
      const bdays = today.sections.find((s) => s.key === 'birthdays')?.items ?? [];
      if (bdays.length === 0)
        return { answer: 'No client birthdays in the next 7 days.', reasoning: ['Computed live from client records.'], recommendation: null, items: [], draft: null };
      return {
        answer: `${bdays.length} birthday${bdays.length === 1 ? '' : 's'} this week:`,
        reasoning: ['Computed live from client birthday records; today first.'],
        recommendation: 'Each row has a ready-written greeting — one tap from the dashboard.',
        items: bdays.map((b) => ({ title: b.clientName, subtitle: b.dateLabel, href: b.href })),
        draft: null,
      };
    }

    case 'dependants_no_life': {
      const [clientsRes, policiesRes] = await Promise.all([
        supabase.from('clients').select('id, full_name, dependants').is('deleted_at', null).gt('dependants', 0),
        supabase.from('policies').select('client_id, policy_type').eq('status', 'active'),
      ]);
      const lifeByClient = new Set(
        (policiesRes.data ?? []).filter((p) => p.policy_type === 'life').map((p) => p.client_id as string),
      );
      const gaps = ((clientsRes.data ?? []) as { id: string; full_name: string; dependants: number }[]).filter(
        (c) => !lifeByClient.has(c.id),
      );
      if (gaps.length === 0)
        return {
          answer: 'No clients with recorded dependants are missing life coverage. (Only clients with the dependants field filled are checked.)',
          reasoning: ['Cross-referenced client dependants against active life policies.'],
          recommendation: 'Fill in dependants on more client profiles to widen this check.',
          items: [],
          draft: null,
        };
      return {
        answer: `${gaps.length} client${gaps.length === 1 ? '' : 's'} with dependants ha${gaps.length === 1 ? 's' : 've'} no life coverage:`,
        reasoning: ['Dependants on record + no active life policy — the clearest protection gap there is.'],
        recommendation: `Start with ${gaps[0]!.full_name} (${gaps[0]!.dependants} dependant${gaps[0]!.dependants === 1 ? '' : 's'}).`,
        items: gaps.map((c) => ({ title: c.full_name, subtitle: `${c.dependants} dependant${c.dependants === 1 ? '' : 's'}, no life policy`, href: `/clients/${c.id}` })),
        draft: null,
      };
    }

    case 'briefing': {
      const today = await getToday();
      const ins = today.briefing.insights;
      return {
        answer: ins.length > 0 ? 'This morning\u2019s briefing:' : 'The briefing is clear today.',
        reasoning: ins.map((i) => i.headline),
        recommendation: today.briefing.focus[0]
          ? `Top of the focus hour: ${today.briefing.focus[0].clientName} — ${today.briefing.focus[0].reason}.`
          : null,
        items: [],
        draft: null,
      };
    }

    case 'client_why': {
      const client = await resolveClient(supabase, intent.nameHint, question);
      if (!client)
        return { answer: 'I couldn\u2019t match that question to a client on your book.', reasoning: ['Tried matching client names against the question.'], recommendation: 'Try the full name as it appears in Clients.', items: [], draft: null };
      const intel = await getClientIntelligence(client.id);
      if (!intel) return { answer: 'No intelligence available for that client.', reasoning: [], recommendation: null, items: [], draft: null };
      const { risk, health } = intel.report;
      return {
        answer: `${client.full_name}: ${risk.level === 'none' ? 'no renewal risk' : `${risk.level} renewal risk (${risk.score}/100)`}, relationship health ${health.overall}/100.`,
        reasoning: risk.reasons,
        recommendation: intel.report.nextAction.text,
        items: [{ title: 'Open profile', subtitle: 'Full intelligence panel', href: `/clients/${client.id}` }],
        draft: intel.suggestedMessage.phone
          ? { clientId: client.id, clientName: client.full_name, phone: intel.suggestedMessage.phone, policyId: intel.suggestedMessage.policyId, message: intel.suggestedMessage.text }
          : null,
      };
    }

    case 'draft': {
      const client = await resolveClient(supabase, intent.nameHint, question);
      if (!client)
        return { answer: 'Which client is this for? I couldn\u2019t match a name.', reasoning: [], recommendation: 'Include the client\u2019s name as it appears in Clients.', items: [], draft: null };
      const intel = await getClientIntelligence(client.id);
      const message = intel?.suggestedMessage.text
        ?? buildDraftMessage('checkin', { clientFirstName: firstNameOf(client.full_name), policyLabel: '', dateText: '' });
      return {
        answer: `Draft for ${client.full_name}, based on their current situation:`,
        reasoning: intel ? [intel.report.nextAction.text] : [],
        recommendation: 'Review, edit if needed, and send — it logs to their timeline automatically.',
        items: [{ title: 'Open profile', subtitle: 'See the full picture first', href: `/clients/${client.id}` }],
        draft: { clientId: client.id, clientName: client.full_name, phone: client.phone_number, policyId: intel?.suggestedMessage.policyId ?? null, message },
      };
    }

    case 'opportunities': {
      const today = await getToday();
      const rev = await getRevenueReport();
      const parts: string[] = [];
      const bd = today.sections.find((s) => s.key === 'birthdays')?.items.length ?? 0;
      const quiet = today.sections.find((s) => s.key === 'quiet')?.items.length ?? 0;
      if (bd > 0) parts.push(`${bd} birthday touchpoint${bd === 1 ? '' : 's'} this week`);
      if (quiet > 0) parts.push(`${quiet} quiet relationship${quiet === 1 ? '' : 's'} to revive`);
      if (rev && rev.bookMissingPremiums > 0) parts.push(`${rev.bookMissingPremiums} polic${rev.bookMissingPremiums === 1 ? 'y' : 'ies'} missing premium data (hiding revenue visibility)`);
      return {
        answer: parts.length > 0 ? `Right now: ${parts.join('; ')}.` : 'No portfolio-wide opportunities detected today.',
        reasoning: ['Per-client coverage gaps (health, CI, life) live on each client\u2019s intelligence panel with reasoning and confidence.'],
        recommendation: 'Ask me about a specific client for their gap analysis, e.g. "why is [name] risky".',
        items: [],
        draft: null,
      };
    }

    case 'quiet': {
      const today = await getToday();
      const quiet = today.sections.find((s) => s.key === 'quiet')?.items ?? [];
      if (quiet.length === 0)
        return { answer: 'Nobody has gone quiet — every established client has contact inside 90 days.', reasoning: ['Contact = Prospekt-sent messages plus your logged interactions.'], recommendation: null, items: [], draft: null };
      return {
        answer: `${quiet.length} client${quiet.length === 1 ? '' : 's'} (top 5 shown) ${quiet.length === 1 ? 'has' : 'have'} gone quiet:`,
        reasoning: ['90+ days without contact, or never contacted; new clients get a 30-day grace period.', 'Contact counts both sent messages and logged calls/meetings.'],
        recommendation: 'Each has a ready check-in draft on the dashboard — no agenda, just a reply-starter.',
        items: quiet.map((qi) => ({ title: qi.clientName, subtitle: qi.reason, href: qi.href })),
        draft: null,
      };
    }

    case 'mark_renewed': {
      const client = await resolveClient(supabase, intent.nameHint, question);
      if (!client)
        return { answer: 'Which client’s policy should I mark renewed? I couldn’t match a name.', reasoning: [], recommendation: 'Include the client’s name, e.g. "mark Tan Wei Ming’s renewal done".', items: [], draft: null };
      const { data: pols } = await supabase
        .from('policies')
        .select('id, policy_type, renewal_date')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .not('renewal_date', 'is', null)
        .order('renewal_date', { ascending: true });
      const target = (pols ?? [])[0];
      if (!target)
        return { answer: `${client.full_name} has no active policy with a renewal date.`, reasoning: [], recommendation: null, items: [{ title: 'Open profile', subtitle: client.full_name, href: `/clients/${client.id}` }], draft: null };
      const res = await markPolicyRenewed(target.id as string);
      if (!res.ok)
        return { answer: `Couldn’t mark it renewed: ${res.error}`, reasoning: [], recommendation: null, items: [{ title: 'Open policy', subtitle: 'Handle it there', href: `/policies/${target.id}` }], draft: null };
      return {
        answer: `Done — ${client.full_name}’s ${target.policy_type} policy is renewed to ${res.data.newRenewalDate}.`,
        reasoning: ['Renewal date rolled forward one year; reminders regenerated; briefing, revenue, and risk updated.'],
        recommendation: null,
        items: [{ title: 'Open policy', subtitle: 'Verify the new schedule', href: `/policies/${target.id}` }],
        draft: null,
      };
    }

    case 'help':
    default:
      return {
        answer: 'I can answer questions about your book using Prospekt\u2019s intelligence engines.',
        reasoning: [
          'Try: "Who should I call today?" · "Which renewals are at risk?" · "Birthdays this week?"',
          '"Why is [client] risky?" · "Draft a WhatsApp for [client]" · "Who haven\u2019t I spoken to in 90 days?"',
        ],
        recommendation: null,
        items: [],
        draft: null,
      };
  }
}
