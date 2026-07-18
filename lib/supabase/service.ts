import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE client — BYPASSES RLS. Use ONLY in trusted server-side
 * automation (the daily send job, the WhatsApp webhook) where there is no user
 * session. NEVER import this into a Client Component or expose the key to the
 * browser. The key is read from a server-only env var.
 *
 * Because it bypasses RLS, every query here MUST filter by agent_id explicitly.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service-role environment variables.");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
