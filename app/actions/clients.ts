'use server';

import { revalidatePath } from 'next/cache';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, mapDbError, type ActionResult } from '@/lib/actions/result';
import { normalizeSgPhone } from '@/lib/format/phone';
import {
  clientCreateSchema,
  clientUpdateSchema,
} from '@/lib/validation/schemas';

/**
 * Client CRUD. Every write goes through here (no client-side Supabase writes).
 * All queries run through the RLS-bound server client, so agent_id is enforced
 * by the database; we also stamp agent_id = userId defensively.
 *
 * ASSUMPTIONS / EDGE CASES
 *  - Phone numbers are normalized to E.164 (+65…) before insert; a bad number
 *    is a validation error, not a DB error.
 *  - "Delete" is a soft delete (sets deleted_at). Pending reminders for the
 *    client are NOT cancelled here in M5 — that cascade belongs with the
 *    scheduler wiring and is handled when policies/clients deactivate in later
 *    milestones. Flagged so it isn't mistaken for complete.
 *  - Duplicate active phone under the same agent surfaces as a validation error
 *    (unique index uq_clients_agent_phone -> SQLSTATE 23505).
 */

export async function createClientRecord(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  let phone: string;
  try {
    phone = normalizeSgPhone(parsed.data.phone_number);
  } catch (e) {
    return fail('validation', e instanceof Error ? e.message : 'Invalid phone.');
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      agent_id: userId,
      full_name: parsed.data.full_name,
      phone_number: phone,
      email: parsed.data.email ?? null,
      birthday: parsed.data.birthday ?? null,
      preferred_platform: parsed.data.preferred_platform,
      notes: parsed.data.notes ?? null,
      ...(parsed.data.occupation !== undefined ? { occupation: parsed.data.occupation ?? null } : {}),
      ...(parsed.data.dependants !== undefined ? { dependants: parsed.data.dependants ?? null } : {}),
    })
    .select('id')
    .single();

  if (error) return mapDbError(error);
  revalidatePath('/clients');
  return ok({ id: data.id as string });
}

export async function updateClientRecord(
  input: unknown,
): Promise<ActionResult<{ id: string; version: number }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }

  let phone: string;
  try {
    phone = normalizeSgPhone(parsed.data.phone_number);
  } catch (e) {
    return fail('validation', e instanceof Error ? e.message : 'Invalid phone.');
  }

  // Optimistic lock: match on version, bump it. Zero rows back = conflict or
  // gone; a follow-up existence check disambiguates for a precise message.
  const { data, error } = await supabase
    .from('clients')
    .update({
      full_name: parsed.data.full_name,
      phone_number: phone,
      email: parsed.data.email ?? null,
      birthday: parsed.data.birthday ?? null,
      preferred_platform: parsed.data.preferred_platform,
      notes: parsed.data.notes ?? null,
      ...(parsed.data.occupation !== undefined ? { occupation: parsed.data.occupation ?? null } : {}),
      ...(parsed.data.dependants !== undefined ? { dependants: parsed.data.dependants ?? null } : {}),
      version: parsed.data.expected_version + 1,
    })
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.expected_version)
    .is('deleted_at', null)
    .select('id, version')
    .maybeSingle();

  if (error) return mapDbError(error);
  if (!data) {
    const { data: exists } = await supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.id)
      .is('deleted_at', null)
      .maybeSingle();
    return exists
      ? fail('conflict', 'This client was changed in another tab. Refresh and try again.')
      : fail('not_found', 'That client no longer exists.');
  }

  revalidatePath('/clients');
  return ok({ id: data.id as string, version: data.version as number });
}

export async function deleteClientRecord(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const id = typeof input === 'string' ? input : '';
  if (!id) return fail('validation', 'Missing client id.');

  // Soft delete. RLS ensures we can only touch our own row.
  const { data, error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return mapDbError(error);
  if (!data) return fail('not_found', 'That client no longer exists.');

  revalidatePath('/clients');
  return ok({ id: data.id as string });
}
