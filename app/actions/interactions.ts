'use server';

import { revalidatePath } from 'next/cache';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, mapDbError, type ActionResult } from '@/lib/actions/result';
import { interactionCreateSchema, type InteractionCreateInput } from '@/lib/validation/schemas';

/**
 * Log a real-world touchpoint (call / meeting / outside-WhatsApp / email /
 * note). This is the ground truth that keeps Gone Quiet honest and risk
 * scores fair — Prospekt-sent messages alone under-count the relationship.
 */
export async function logInteraction(input: InteractionCreateInput): Promise<ActionResult<{ id: string }>> {
  const parsed = interactionCreateSchema.safeParse(input);
  if (!parsed.success) return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');

  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const { data, error } = await supabase
    .from('interactions')
    .insert({
      agent_id: userId,
      client_id: parsed.data.client_id,
      interaction_type: parsed.data.interaction_type,
      ...(parsed.data.occurred_at ? { occurred_at: parsed.data.occurred_at } : {}),
      note: parsed.data.note ?? null,
    })
    .select('id')
    .single();

  if (error) return mapDbError(error);
  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath('/');
  return ok({ id: data.id as string });
}
