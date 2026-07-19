import { createClient } from '@/lib/supabase/server';

import type { PolicyType, PaymentMode } from '@/lib/policies/behavior';
export type { PolicyType, PaymentMode };
export type PolicyStatus = 'active' | 'expired' | 'cancelled';

/** A policy row with its client's name joined in, for list/detail display. */
export interface PolicyListItem {
  id: string;
  client_id: string;
  client_name: string;
  policy_type: PolicyType;
  destination: string | null;
  start_date: string;
  end_date: string | null;
  renewal_date: string | null;
  insurer: string | null;
  policy_number: string | null;
  premium_amount: number | null;
  payment_mode: PaymentMode | null;
  sum_assured: number | null;
  riders: Array<{ name: string; sum_assured?: number }>;
  status: PolicyStatus;
  version: number;
  created_at: string;
}

const SELECT = 'id, client_id, policy_type, destination, start_date, end_date, renewal_date, insurer, policy_number, premium_amount, payment_mode, sum_assured, riders, status, version, created_at, clients(full_name)';

// Supabase returns the joined relation as clients: { full_name } | null.
function mapRow(row: Record<string, unknown>): PolicyListItem {
  const client = row.clients as { full_name: string } | null;
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    client_name: client?.full_name ?? 'Unknown client',
    policy_type: row.policy_type as PolicyType,
    destination: (row.destination as string | null) ?? null,
    start_date: row.start_date as string,
    end_date: (row.end_date as string | null) ?? null,
    renewal_date: (row.renewal_date as string | null) ?? null,
    insurer: (row.insurer as string | null) ?? null,
    policy_number: (row.policy_number as string | null) ?? null,
    premium_amount: row.premium_amount != null ? Number(row.premium_amount) : null,
    payment_mode: (row.payment_mode as PaymentMode | null) ?? null,
    sum_assured: row.sum_assured != null ? Number(row.sum_assured) : null,
    riders: Array.isArray(row.riders) ? (row.riders as Array<{ name: string; sum_assured?: number }>) : [],
    status: row.status as PolicyStatus,
    version: row.version as number,
    created_at: row.created_at as string,
  };
}

/**
 * All of the current agent's policies, newest first (RLS-scoped). Optional
 * filter by status. Reads only — writes go through the policy server actions.
 */
export async function getPolicies(status?: PolicyStatus): Promise<PolicyListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from('policies')
    .select(SELECT)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** Policies belonging to one client (RLS-scoped), newest first. */
export async function getPoliciesForClient(clientId: string): Promise<PolicyListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('policies')
    .select(SELECT)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** A single policy by id (RLS-scoped). Null if not found / not owned. */
export async function getPolicyById(id: string): Promise<PolicyListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('policies')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** A scheduled reminder belonging to a policy, for the policy detail view. */
export interface PolicyReminder {
  id: string;
  message_type: string;
  scheduled_at: string;
  status: string;
}

/** Reminders for one policy (RLS-scoped), soonest first. */
export async function getRemindersForPolicy(policyId: string): Promise<PolicyReminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('id, message_type, scheduled_at, status')
    .eq('policy_id', policyId)
    .order('scheduled_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    message_type: r.message_type as string,
    scheduled_at: r.scheduled_at as string,
    status: r.status as string,
  }));
}
