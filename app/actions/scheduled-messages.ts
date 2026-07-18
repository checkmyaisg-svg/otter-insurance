'use server';

import { revalidatePath } from 'next/cache';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, mapDbError, type ActionResult } from '@/lib/actions/result';
import { rescheduleSchema, cancelReminderSchema } from '@/lib/validation/schemas';

/**
 * Admin operations on individual reminders. Both are single-row updates fenced
 * by RLS and guarded on status so only PENDING reminders can be changed — a
 * reminder that already sent/failed/processing is immutable here.
 *
 * ASSUMPTIONS / EDGE CASES
 *  - Rescheduling resets retry state (attempts, next_retry_at) so a moved
 *    reminder starts clean.
 *  - Cancelling a non-pending reminder is a no-op that returns not_found rather
 *    than silently succeeding, so the UI can tell the user why.
 */

export async function rescheduleReminder(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({
      scheduled_at: parsed.data.scheduled_at,
      status: 'pending',
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      error_code: null,
    })
    .eq('id', parsed.data.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return mapDbError(error);
  if (!data) return fail('not_found', 'Only pending reminders can be rescheduled.');

  revalidatePath('/messages');
  return ok({ id: data.id as string });
}

export async function cancelReminder(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = cancelReminderSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return mapDbError(error);
  if (!data) return fail('not_found', 'Only pending reminders can be cancelled.');

  revalidatePath('/messages');
  return ok({ id: data.id as string });
}
