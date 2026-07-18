import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — uses the PUBLIC anon key and is bound by RLS.
 * Safe to use in Client Components. Never import the service client here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
