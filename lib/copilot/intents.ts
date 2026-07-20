/**
 * COPILOT INTENT ROUTER — pure, deterministic question classification.
 * Maps plain-English questions to the intelligence engine that answers them.
 * No LLM required for the core questions; an LLM adapter can layer on top of
 * this contract later (same Intent union, fuzzier classification).
 */

export type Intent =
  | { kind: 'focus' }              // who should I call today
  | { kind: 'at_risk_renewals' }   // which renewals are at risk
  | { kind: 'birthdays' }
  | { kind: 'dependants_no_life' }
  | { kind: 'briefing' }
  | { kind: 'client_why'; nameHint: string | null }   // why is X risky
  | { kind: 'draft'; nameHint: string | null }        // draft a message for X
  | { kind: 'opportunities' }
  | { kind: 'revenue_at_risk' }
  | { kind: 'quiet' }              // who haven't I spoken to
  | { kind: 'mark_renewed'; nameHint: string | null }
  | { kind: 'help' };

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Extract a probable client-name fragment after common prepositions. */
export function nameHintFrom(question: string): string | null {
  const m = question.match(/(?:for|about|to|is|why is|message)\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,3})/);
  return m ? m[1]!.trim() : null;
}

export function classify(question: string): Intent {
  const q = question.toLowerCase().trim();

  if (has(q, 'mark') && has(q, 'renew'))
    return { kind: 'mark_renewed', nameHint: nameHintFrom(question) };
  if (has(q, 'draft', 'write a', 'whatsapp for', 'message for', 'message to', 'send'))
    return { kind: 'draft', nameHint: nameHintFrom(question) };
  if (has(q, 'why') && has(q, 'risk', 'risky', 'high risk', 'considered'))
    return { kind: 'client_why', nameHint: nameHintFrom(question) };
  if (has(q, 'dependant', 'dependent') )
    return { kind: 'dependants_no_life' };
  if (has(q, 'birthday'))
    return { kind: 'birthdays' };
  if (has(q, 'briefing', 'morning brief', 'summarise today', 'summarize today'))
    return { kind: 'briefing' };
  if (has(q, 'how much') || (has(q, 'revenue', 'income', 'money') && has(q, 'risk', 'at stake')))
    return { kind: 'revenue_at_risk' };
  if (has(q, 'renewal') && has(q, 'risk', 'at risk', 'danger'))
    return { kind: 'at_risk_renewals' };
  if (has(q, "haven't spoken", 'havent spoken', 'not spoken', '90 day', 'gone quiet', 'no contact', 'quiet'))
    return { kind: 'quiet' };
  if (has(q, 'opportunit', 'missing', 'cross-sell', 'cross sell', 'upsell'))
    return { kind: 'opportunities' };
  if (has(q, 'who should i', 'call today', 'contact today', 'focus', 'priorit', 'what should i do'))
    return { kind: 'focus' };
  if (has(q, 'renewal'))
    return { kind: 'at_risk_renewals' };
  return { kind: 'help' };
}
