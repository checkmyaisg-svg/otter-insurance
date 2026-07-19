'use server';

import { getAgent } from '@/lib/actions/auth';
import { POLICY_TYPE_LABEL } from '@/lib/policies/behavior';
import type { PolicyType } from '@/lib/policies/behavior';

export interface PaletteResult {
  id: string;
  group: 'Clients' | 'Policies';
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Command-palette search. One round trip, two RLS-scoped queries, ≤6 results
 * per group. Matching is case-insensitive substring (ilike) — honest and fast;
 * fuzzy ranking can layer on later without changing the contract.
 */
export async function paletteSearch(query: string): Promise<PaletteResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { supabase, userId } = await getAgent();
  if (!userId) return [];

  const like = `%${q.replace(/[%_]/g, '')}%`;

  const [clientsRes, policiesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, phone_number')
      .is('deleted_at', null)
      .ilike('full_name', like)
      .limit(6),
    supabase
      .from('policies')
      .select('id, policy_type, insurer, policy_number, clients(full_name)')
      .eq('status', 'active')
      .or(`policy_number.ilike.${like},insurer.ilike.${like}`)
      .limit(6),
  ]);

  const results: PaletteResult[] = [];
  for (const c of clientsRes.data ?? []) {
    results.push({
      id: `c-${c.id}`,
      group: 'Clients',
      title: c.full_name as string,
      subtitle: (c.phone_number as string) ?? '',
      href: `/clients/${c.id}`,
    });
  }
  for (const p of policiesRes.data ?? []) {
    const client = (p.clients as { full_name?: string } | null)?.full_name ?? '';
    const label = POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? p.policy_type;
    results.push({
      id: `p-${p.id}`,
      group: 'Policies',
      title: `${client} — ${label}`,
      subtitle: [p.insurer, p.policy_number].filter(Boolean).join(' · '),
      href: `/policies/${p.id}`,
    });
  }
  return results;
}
