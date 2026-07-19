'use server';

import { randomUUID } from 'crypto';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, mapDbError, type ActionResult } from '@/lib/actions/result';

/**
 * Record that the advisor opened a WhatsApp draft for a client.
 *
 * DESIGN: logged as a `manual` row in scheduled_messages with status 'sent' —
 * the schema was built for exactly this (policy_id optional for manual, random
 * idempotency key, sent_at timestamp). Benefits over a new log table:
 *   - zero migration (production freeze friendly)
 *   - the client's timeline automatically shows the touchpoint
 *   - the future send job reads one unified message history
 * Honest semantics note: this records "draft opened in WhatsApp", not
 * "delivered" — wa.me cannot confirm delivery. template_name marks it clearly.
 */
export async function logWhatsAppDraftOpened(input: {
  clientId: string;
  policyId?: string | null;
  body: string;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');
  if (!input.clientId) return fail('validation', 'Missing client.');

  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      agent_id: userId,
      client_id: input.clientId,
      policy_id: input.policyId ?? null,
      message_type: 'manual',
      template_name: 'wa_draft_opened_v1',
      scheduled_at: new Date().toISOString(),
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
      idempotency_key: `wa-draft:${randomUUID()}`,
    })
    .select('id')
    .single();

  if (error) return mapDbError(error);
  return ok({ id: data.id as string });
}
