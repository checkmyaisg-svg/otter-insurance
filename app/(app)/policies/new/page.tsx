import { getClients } from '@/lib/data/clients';
import { createPolicyRecord } from '@/app/actions/policies';
import { PolicyForm, type PolicyFormValues } from '@/components/policies/PolicyForm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Add Policy page. Loads the agent's clients for the picker, renders the
 * adaptive PolicyForm, and wires the tested createPolicyRecord action — which
 * runs the scheduler and generates this policy's reminders atomically.
 * The `?client=` param pre-selects and locks a client (used when adding from a
 * client's page).
 */
export default async function NewPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const clients = await getClients();

  async function submit(values: PolicyFormValues) {
    'use server';
    const base = {
      client_id: values.client_id,
      policy_type: values.policy_type,
      start_date: values.start_date,
      end_date: values.end_date,
    };
    // Shape the payload to match the discriminated-union schema.
    const payload =
      values.policy_type === 'travel'
        ? { ...base, destination: values.destination }
        : { ...base, renewal_date: values.renewal_date };
    return createPolicyRecord(payload);
  }

  if (clients.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-6 md:p-8">
        <h1 className="text-2xl font-semibold">Add policy</h1>
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">You need a client first.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a client, then create their policy.
          </p>
          <Link href="/clients/new" className="mt-3 inline-block text-sm text-primary hover:underline">
            Add a client →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Add policy</h1>
        <p className="text-sm text-muted-foreground">
          Saving generates this policy&apos;s reminders automatically.
        </p>
      </div>
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
