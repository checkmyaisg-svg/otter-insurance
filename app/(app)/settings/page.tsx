import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * Settings — V1 shows the agent's profile and a WhatsApp connection status
 * placeholder (the connection flow is built in the WhatsApp milestone). Kept
 * intentionally simple; no business logic changes in this UI milestone.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: agent } = user
    ? await supabase.from('agents').select('full_name, company_name, phone_number').eq('id', user.id).maybeSingle()
    : { data: null };

  function Field({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col gap-0.5">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</dt>
        <dd className="text-sm">{value || '—'}</dd>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <PageHeader title="Settings" subtitle="Your account and connections." />

      <div className="space-y-6">
        <section className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
          <h2 className="mb-4 text-sm font-semibold">Profile</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" value={(agent?.full_name as string) ?? ''} />
            <Field label="Email" value={user?.email ?? ''} />
            <Field label="Company" value={(agent?.company_name as string) ?? ''} />
            <Field label="Phone" value={(agent?.phone_number as string) ?? ''} />
          </dl>
        </section>

        <section className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
          <h2 className="mb-1 text-sm font-semibold">WhatsApp connection</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Message drafts open in your own WhatsApp today. Automatic sending arrives with the WhatsApp Business connection.
          </p>
          <div className="flex items-center gap-2 rounded bg-muted/60 p-4">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">Not connected yet</span>
          </div>
        </section>
      </div>
    </main>
  );
}
