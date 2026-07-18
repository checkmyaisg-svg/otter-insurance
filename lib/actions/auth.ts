import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the current agent for a server action. Returns the RLS-bound server
 * client and the user id, or null user if unauthenticated. getUser() validates
 * the token against Supabase rather than trusting the cookie blindly.
 */
export async function getAgent(): Promise<{
  supabase: SupabaseClient;
  userId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}
