'use server';

import { z } from 'zod';
import { getAgent } from '@/lib/actions/auth';
import { normalizeSgPhone } from '@/lib/format/phone';
import { ok, fail, type ActionResult } from '@/lib/actions/result';

/**
 * CONTACT IMPORT — server actions (tenant-scoped, RLS-respecting).
 *
 * Two actions:
 *  - getExistingPhones(): the tenant's current client numbers, for dedup in the
 *    browser preview (so categorization can happen client-side without leaking
 *    other tenants' data — RLS already scopes this to the agent).
 *  - importClients(): bulk-inserts the chosen contacts. Re-normalizes and
 *    re-checks server-side (never trust the client), inserts in one batch, and
 *    relies on the unique (agent_id, phone_number) index as the final guard
 *    against races/duplicates.
 */

export async function getExistingPhones(): Promise<string[]> {
  const { supabase, userId } = await getAgent();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('phone_number')
    .is('deleted_at', null);
  if (error) return [];
  return (data ?? []).map((r) => r.phone_number as string);
}

const importItemSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal('')).transform((v) => v || undefined),
});
const importSchema = z.object({ contacts: z.array(importItemSchema).min(1).max(2000) });

export interface ImportSummary {
  imported: number;
  skipped: number; // duplicates / already existed
  failed: number; // unexpected insert errors
}

export async function importClients(input: unknown): Promise<ActionResult<ImportSummary>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid import payload.');
  }

  // Re-normalize server-side and drop anything that no longer validates.
  // De-dup within the payload too (last-write-wins on name).
  const byPhone = new Map<string, { full_name: string; email?: string }>();
  for (const c of parsed.data.contacts) {
    try {
      const phone = normalizeSgPhone(c.phone);
      byPhone.set(phone, { full_name: c.full_name, email: c.email });
    } catch {
      // silently skip — these shouldn't reach here (preview filters them)
    }
  }
  if (byPhone.size === 0) return fail('validation', 'No valid contacts to import.');

  // Pull existing numbers to skip duplicates before insert (belt; unique index is braces).
  const { data: existingRows } = await supabase
    .from('clients')
    .select('phone_number')
    .is('deleted_at', null);
  const existing = new Set((existingRows ?? []).map((r) => r.phone_number as string));

  const rows = [...byPhone.entries()]
    .filter(([phone]) => !existing.has(phone))
    .map(([phone, v]) => ({
      agent_id: userId,
      full_name: v.full_name,
      phone_number: phone,
      email: v.email ?? null,
      preferred_platform: 'whatsapp' as const,
    }));

  const skippedExisting = byPhone.size - rows.length;

  if (rows.length === 0) {
    return ok({ imported: 0, skipped: skippedExisting, failed: 0 });
  }

  // Bulk insert. If a race causes a unique violation, fall back to per-row so a
  // single collision doesn't fail the whole batch.
  const { data, error } = await supabase.from('clients').insert(rows).select('id');
  if (!error) {
    return ok({ imported: data?.length ?? rows.length, skipped: skippedExisting, failed: 0 });
  }

  // Fallback: insert one-by-one, counting duplicates as skipped.
  let imported = 0;
  let skipped = skippedExisting;
  let failed = 0;
  for (const row of rows) {
    const { error: e } = await supabase.from('clients').insert(row);
    if (!e) imported++;
    else if (e.code === '23505') skipped++; // unique_violation
    else failed++;
  }
  return ok({ imported, skipped, failed });
}
