import Link from 'next/link';
import { getClients } from '@/lib/data/clients';
import { createPolicyRecord } from '@/app/actions/policies';
import { PolicyForm, type PolicySubmitShape } from '@/components/policies/PolicyForm';
import { PageHeader } from '@/components/shell/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * Add Policy page. The behavior-driven PolicyForm builds the discriminated
 * union payload; this page passes it to the tested createPolicyRecord action,
 * which schedules reminders per the policy's behavior atomically.
 */
export default async function NewPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const clients = await getClients();

  async function submit(shape: PolicySubmitShape) {
    'use server';
    return createPolicyRecord(shape);
  }

  if (clients.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-6 md:p-8">
        <PageHeader title="Add policy" />
        <div className="rounded-lg bg-muted/60 bg-card p-8 text-center">
          <p className="text-sm font-medium">You need a client first.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a client, then create their policy.</p>
          <Link href="/clients/new" className="mt-3 inline-block text-sm text-primary hover:underline">
            Add a client →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <PageHeader
        title="Add policy"
        subtitle="Saving generates this policy's reminders automatically."
      />
      <PolicyForm
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        lockedClientId={client}
        submitLabel="Add policy"
        successMessage="Policy added and reminders scheduled."
        onSubmit={submit}
      />
    </main>
  );
}
