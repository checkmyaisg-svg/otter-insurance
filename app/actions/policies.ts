'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, mapDbError, type ActionResult } from '@/lib/actions/result';
import { policyCreateSchema, policyUpdateSchema } from '@/lib/validation/schemas';
import {
  scheduleForPolicy,
  reconcileReminders,
  type PolicyInput,
  type ExistingReminder,
  type AutomatedMessageType,
  type ScheduledStatus,
} from '@/lib/reminders/scheduler';

/**
 * Policy CRUD. Create and update are the milestone's core: they run the tested
 * TypeScript scheduler to compute reminders, then persist the policy AND the
 * reminder diff ATOMICALLY through a Postgres RPC (one statement = one
 * transaction). Optimistic locking is enforced inside the update RPC.
 *
 * ASSUMPTIONS / EDGE CASES
 *  - The policy id is generated here (randomUUID) BEFORE scheduling, so the
 *    scheduler can build deterministic idempotency keys that match the row that
 *    gets inserted.
 *  - Setting status to 'cancelled' on update makes scheduleForPolicy return [],
 *    which makes reconcile cancel all pending reminders — one code path covers
 *    "cancel policy".
 *  - The RPC stamps agent_id from auth.uid() and verifies client ownership via
 *    RLS, so a spoofed client_id or agent_id cannot slip through.
 *  - Reconcile never touches sent/processing/failed reminders; the RPC guards
 *    the same way as a second line of defense.
 */

// Build the scheduler's PolicyInput from validated data + a known id/agent.
function toPolicyInput(
  id: string,
  agentId: string,
  clientId: string,
  shape:
    | { policy_type: 'travel'; destination: string; start_date: string; end_date: string }
    | {
        policy_type: 'car' | 'home';
        start_date: string;
        end_date: string;
        renewal_date: string;
      },
  status: 'active' | 'expired' | 'cancelled',
): PolicyInput {
  return {
    id,
    agentId,
    clientId,
    policyType: shape.policy_type,
    destination: shape.policy_type === 'travel' ? shape.destination : null,
    startDate: shape.start_date,
    endDate: shape.end_date,
    renewalDate: shape.policy_type === 'travel' ? null : shape.renewal_date,
    status,
  };
}

export async function createPolicyRecord(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = policyCreateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }
  const shape = parsed.data;
  const policyId = randomUUID();

  const policyInput = toPolicyInput(
    policyId,
    userId,
    shape.client_id,
    shape,
    'active',
  );
  const planned = scheduleForPolicy(policyInput);

  const { error } = await supabase.rpc('create_policy_with_reminders', {
    p_policy: {
      id: policyId,
      client_id: shape.client_id,
      policy_type: shape.policy_type,
      destination: policyInput.destination,
      start_date: shape.start_date,
      end_date: shape.end_date,
      renewal_date: policyInput.renewalDate,
      status: 'active',
    },
    p_reminders: planned.map((p) => ({
      messageType: p.messageType,
      scheduledAt: p.scheduledAt,
      templateName: p.templateName,
      idempotencyKey: p.idempotencyKey,
    })),
  });

  if (error) return mapDbError(error);
  revalidatePath('/policies');
  return ok({ id: policyId });
}

export async function updatePolicyRecord(
  input: unknown,
): Promise<ActionResult<{ id: string; version: number }>> {
  const { supabase, userId } = await getAgent();
  if (!userId) return fail('unauthorized', 'You are not signed in.');

  const parsed = policyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input.');
  }
  const { id, expected_version, status, policy: shape } = parsed.data;

  // Load existing reminders so reconcile can diff (RLS-scoped to this agent).
  const { data: existingRows, error: loadErr } = await supabase
    .from('scheduled_messages')
    .select('id, policy_id, message_type, scheduled_at, status')
    .eq('policy_id', id);
  if (loadErr) return mapDbError(loadErr);

  const existing: ExistingReminder[] = (existingRows ?? [])
    // manual sends have no place in policy reconcile
    .filter((r) => r.message_type !== 'manual')
    .map((r) => ({
      id: r.id as string,
      policyId: r.policy_id as string,
      messageType: r.message_type as AutomatedMessageType,
      scheduledAt: new Date(r.scheduled_at as string).toISOString(),
      status: r.status as ScheduledStatus,
    }));

  const policyInput = toPolicyInput(id, userId, shape.client_id, shape, status);
  const planned = scheduleForPolicy(policyInput);
  const diff = reconcileReminders(existing, planned);

  const { data, error } = await supabase.rpc('update_policy_with_reminders', {
    p_policy_id: id,
    p_expected_version: expected_version,
    p_policy: {
      client_id: shape.client_id,
      policy_type: shape.policy_type,
      destination: policyInput.destination,
      start_date: shape.start_date,
      end_date: shape.end_date,
      renewal_date: policyInput.renewalDate,
      status,
    },
    p_inserts: diff.toInsert.map((p) => ({
      messageType: p.messageType,
      scheduledAt: p.scheduledAt,
      templateName: p.templateName,
      idempotencyKey: p.idempotencyKey,
    })),
    p_updates: diff.toUpdate,
    p_cancel_ids: diff.toCancelIds,
  });

  if (error) return mapDbError(error);
  revalidatePath('/policies');
  return ok({ id, version: data as number });
}

export async function cancelPolicyRecord(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  // Cancelling a policy is an update with status='cancelled'; reconcile then
  // cancels every pending reminder. Callers pass { id, expected_version, policy }.
  const res = await updatePolicyRecord(
    typeof input === 'object' && input !== null
      ? { ...(input as Record<string, unknown>), status: 'cancelled' }
      : input,
  );
  if (!res.ok) return res;
  return ok({ id: res.data.id });
}
