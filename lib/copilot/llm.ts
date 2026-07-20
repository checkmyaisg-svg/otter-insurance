import type { Intent } from './intents';

/**
 * LLM CLASSIFICATION ADAPTER — optional long-tail understanding.
 *
 * Role: classify + extract entities ONLY. The model never composes answers —
 * answers come from the deterministic engines, so nothing it says can be
 * hallucinated into the product. Activation: ANTHROPIC_API_KEY present in the
 * server environment (never NEXT_PUBLIC). Failure of any kind (no key,
 * timeout, bad JSON) returns null and the deterministic router's verdict
 * stands. Model: Haiku — classification needs speed, not depth.
 */

const INTENT_KINDS = [
  'focus',
  'at_risk_renewals',
  'birthdays',
  'dependants_no_life',
  'briefing',
  'client_why',
  'draft',
  'opportunities',
  'revenue_at_risk',
  'quiet',
  'mark_renewed',
  'help',
] as const;

export function buildClassifierPrompt(question: string, clientNames: string[]): string {
  return [
    'You classify a question from an insurance advisor into exactly one intent.',
    `Intents: ${INTENT_KINDS.join(', ')}.`,
    'Meanings: focus=who to prioritise/call today; at_risk_renewals=renewals in danger;',
    'birthdays=upcoming client birthdays; dependants_no_life=clients with dependants lacking life cover;',
    'briefing=summarise the morning briefing; client_why=explain one client\'s risk/health;',
    'draft=write a message for one client; opportunities=missed cross-sell; revenue_at_risk=money at risk;',
    'quiet=clients not contacted recently; mark_renewed=record that a renewal was completed; help=anything else.',
    clientNames.length > 0 ? `Known client names: ${clientNames.slice(0, 100).join('; ')}.` : '',
    'Respond with ONLY a JSON object, no prose: {"kind":"<intent>","nameHint":"<client name or null>"}',
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Parse the model's reply into an Intent; null on anything malformed. */
export function parseLlmIntent(raw: string): Intent | null {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const obj = JSON.parse(clean) as { kind?: string; nameHint?: string | null };
    if (!obj.kind || !(INTENT_KINDS as readonly string[]).includes(obj.kind)) return null;
    const nameHint = typeof obj.nameHint === 'string' && obj.nameHint.trim() ? obj.nameHint.trim() : null;
    switch (obj.kind) {
      case 'client_why':
      case 'draft':
      case 'mark_renewed':
        return { kind: obj.kind, nameHint };
      default:
        return { kind: obj.kind } as Intent;
    }
  } catch {
    return null;
  }
}

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classifyWithLlm(question: string, clientNames: string[]): Promise<Intent | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 120,
        messages: [{ role: 'user', content: buildClassifierPrompt(question, clientNames) }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return parseLlmIntent(text);
  } catch {
    return null; // absent, slow, or malformed — the deterministic router stands
  }
}
