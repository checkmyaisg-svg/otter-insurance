'use server';

import { revalidatePath } from 'next/cache';
import { getAgent } from '@/lib/actions/auth';
import { ok, fail, type ActionResult } from '@/lib/actions/result';
import { updatePolicyRecord, cancelPolicyRecord } from '@/app/actions/policies';
import { rollRenewalForward } from '@/lib/dates/renewal';

/**
 * RENEWAL OUTCOMES — the verbs that close the loop.
 *
 * "Mark renewed" rolls renewal_date forward one year THROUGH the existing
 * update rails (updatePolicyRecord → reconcile RPC), so renewal reminders
 * regenerate for the new date and every engine (briefing, revenue, risk,
 * dashboard) goes quiet about it simultaneously — one source of truth, zero
 * duplicated logic. "Mark lost" is the existing cancel path plus a recorded
 * reason. Both try to log an interaction for the client timeline; that log is
 * best-effort (tolerates pre-0007 databases).
 */

async function loadPolicyForOutcome(policyId: string) {
  const { supabase, userId } = await getAgent();
  if (!userId) return { supabase, policy: null as null, error: fail('unauthorized', 'You are not signed in.') };
  const { data, error } = await supabase
    .from('policies')
    .select('id, version, client_id, policy_type, destination, start_date, end_date, renewal_date, status, insurer, policy_number, premium_amount, payment_mode, sum_assured, riders')
    .eq('id', policyId)
    .single();
  if (error || !data) return { supabase, policy: null, error: fail('not_found', 'Policy not found.') };
  return { supabase, policy: data, error: null };
}

function shapeFrom(policy: Record<string, unknown>) {
  return {
    client_id: policy.client_id,
    policy_type: policy.policy_type,
    destination: policy.destination ?? undefined,
    start_date: policy.start_date,
    end_date: policy.end_date ?? undefined,
    renewal_date: policy.renewal_date ?? undefined,
    insurer: policy.insurer ?? undefined,
    policy_number: policy.policy_number ?? undefined,
    premium_amount: policy.premium_amount ?? undefined,
    payment_mode: policy.payment_mode ?? undefined,
    sum_assured: policy.sum_assured ?? undefined,
    riders: policy.riders ?? undefined,
  };
}

async function tryLogOutcome(clientId: string, note: string) {
  try {
    const { supabase, userId } = await getAgent();
    if (!userId) return;
    await supabase.from('interactions').insert({
      agent_id: userId,
      client_id: clientId,
      interaction_type: 'note',
      note,
    });
  } catch {
    // pre-0007 database: outcome still succeeds, only the timeline note is skipped
  }
}

export async function markPolicyRenewed(policyId: string): Promise<ActionResult<{ id: string; newRenewalDate: string }>> {
  const { policy, error } = await loadPolicyForOutcome(policyId);
  if (!policy) return error!;
  if (!policy.renewal_date) return fail('validation', 'This policy has no renewal date to roll forward.');
  if (policy.status !== 'active') return fail('validation', 'Only active policies can be marked renewed.');

  const newRenewalDate = rollRenewalForward(policy.renewal_date as string);
  const res = await updatePolicyRecord({
    id: policy.id,
    expected_version: policy.version,
    status: 'active',
    policy: { ...shapeFrom(policy), renewal_date: newRenewalDate },
  });
  if (!res.ok) return res;

  await tryLogOutcome(
    policy.client_id as string,
    `Renewal secured — ${policy.policy_type} policy renewed to ${newRenewalDate}.`,
  );
  revalidatePath(`/policies/${policyId}`);
  revalidatePath('/');
  revalidatePath('/revenue');
  return ok({ id: policyId, newRenewalDate });
}

export async function markPolicyLost(policyId: string, reason: string): Promise<ActionResult<{ id: string }>> {
  const { policy, error } = await loadPolicyForOutcome(policyId);
  if (!policy) return error!;
  if (policy.status !== 'active') return fail('validation', 'Only active policies can be marked lost.');

  const res = await cancelPolicyRecord({
    id: policy.id,
    expected_version: policy.version,
    policy: shapeFrom(policy),
  });
  if (!res.ok) return res;

  await tryLogOutcome(
    policy.client_id as string,
    `Renewal lost — ${policy.policy_type} policy not renewed.${reason.trim() ? ` Reason: ${reason.trim()}` : ''}`,
  );
  revalidatePath(`/policies/${policyId}`);
  revalidatePath('/');
  revalidatePath('/revenue');
  return ok({ id: policyId });
}
