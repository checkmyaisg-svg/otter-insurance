import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Health-check page (Milestone 2 verification). Renders three independent
 * checks so a failure in one doesn't hide the others:
 *   1. Database connection  — service-role read of a known table.
 *   2. Auth connection      — can we reach the auth service at all.
 *   3. Current user         — who (if anyone) is logged in via RLS session.
 *
 * This page is a diagnostic tool. It is NOT linked from the app and is safe to
 * delete once the backend is verified. It intentionally reports errors verbatim
 * so setup problems are obvious.
 */

export const dynamic = 'force-dynamic'; // never cache a health check

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. DATABASE — use the service client (bypasses RLS) to confirm the schema
  // exists and is reachable, independent of any login.
  try {
    const svc = createServiceClient();
    const { error, count } = await svc
      .from('clients')
      .select('*', { count: 'exact', head: true });
    if (error) {
      checks.push({ label: 'Database connection', ok: false, detail: error.message });
    } else {
      checks.push({
        label: 'Database connection',
        ok: true,
        detail: `Reached "clients" table (rows: ${count ?? 0}).`,
      });
    }
  } catch (e) {
    checks.push({
      label: 'Database connection',
      ok: false,
      detail: e instanceof Error ? e.message : 'Unknown error (check SUPABASE_SERVICE_ROLE_KEY).',
    });
  }

  // 2. AUTH — confirm the auth endpoint responds. getSession() succeeding
  // (even with a null session) means the auth service is reachable.
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    checks.push({
      label: 'Auth connection',
      ok: !error,
      detail: error ? error.message : 'Auth service reachable.',
    });
  } catch (e) {
    checks.push({
      label: 'Auth connection',
      ok: false,
      detail: e instanceof Error ? e.message : 'Unknown auth error.',
    });
  }

  // 3. CURRENT USER — getUser() validates the session token against Supabase.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    checks.push({
      label: 'Current logged-in user',
      ok: true,
      detail: user ? `${user.email} (${user.id})` : 'No user signed in (this is fine).',
    });
  } catch (e) {
    checks.push({
      label: 'Current logged-in user',
      ok: false,
      detail: e instanceof Error ? e.message : 'Unknown error.',
    });
  }

  return checks;
}

export default async function HealthPage() {
  const checks = await runChecks();
  const allOk = checks.every((c) => c.ok);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-1 text-2xl font-semibold text-primary">System Health</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Backend connectivity diagnostics. Delete this page once verified.
      </p>

      <div
        className={`mb-6 rounded-md px-4 py-3 text-sm font-medium ${
          allOk
            ? 'bg-primary/10 text-primary'
            : 'bg-destructive/10 text-destructive'
        }`}
      >
        {allOk ? 'All checks passed.' : 'One or more checks failed — see below.'}
      </div>

      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.label} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  c.ok ? 'bg-green-500' : 'bg-destructive'
                }`}
                aria-hidden
              />
              <span className="font-medium">{c.label}</span>
              <span
                className={`ml-auto text-xs ${
                  c.ok ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {c.ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <p className="mt-2 break-words text-sm text-muted-foreground">{c.detail}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
