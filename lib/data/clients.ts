import { createClient } from '@/lib/supabase/server';

/** A client row as shown in the Clients list, with a derived policy count. */
export interface ClientListItem {
  id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  birthday: string | null;
  preferred_platform: 'whatsapp' | 'wechat' | 'telegram';
  notes: string | null;
  created_at: string;
  version: number;
  policy_count: number;
}

/**
 * Fetch the current agent's (non-deleted) clients, newest first, with a count
 * of each client's policies. RLS scopes this to the logged-in agent — no
 * agent_id filter is needed in the query, the policies enforce it. Reads only;
 * all writes go through server actions.
 *
 * `search` filters by name or phone (case-insensitive, partial match).
 */
export async function getClients(search?: string): Promise<ClientListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('clients')
    .select('id, full_name, phone_number, email, birthday, preferred_platform, notes, created_at, version, policies(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},phone_number.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    // Supabase returns the aggregate as policies: [{ count: n }]
    const rel = row.policies as unknown as { count: number }[] | null;
    const policy_count = Array.isArray(rel) && rel[0] ? rel[0].count : 0;
    return {
      id: row.id as string,
      full_name: row.full_name as string,
      phone_number: row.phone_number as string,
      email: (row.email as string | null) ?? null,
      birthday: (row.birthday as string | null) ?? null,
      preferred_platform: row.preferred_platform as ClientListItem['preferred_platform'],
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
      version: row.version as number,
      policy_count,
    };
  });
}

/** Fetch a single client by id (RLS-scoped). Returns null if not found/owned. */
export async function getClientById(id: string): Promise<ClientListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, phone_number, email, birthday, preferred_platform, notes, created_at, version, policies(count)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const rel = data.policies as unknown as { count: number }[] | null;
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone_number: data.phone_number as string,
    email: (data.email as string | null) ?? null,
    birthday: (data.birthday as string | null) ?? null,
    preferred_platform: data.preferred_platform as ClientListItem['preferred_platform'],
    notes: (data.notes as string | null) ?? null,
    created_at: data.created_at as string,
    version: data.version as number,
    policy_count: Array.isArray(rel) && rel[0] ? rel[0].count : 0,
  };
}
