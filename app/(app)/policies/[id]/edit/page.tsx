import { notFound } from 'next/navigation';
import { getPolicyById } from '@/lib/data/policies';
import { getClients } from '@/lib/data/clients';
import { updatePolicyRecord } from '@/app/actions/policies';
import { PolicyForm, type PolicyFormValues } from '@/components/policies/PolicyForm';

export const dynamic = 'force-dynamic';

/**
 * Edit Policy page. Prefills the adaptive PolicyForm with the policy's current
 * values and wires updatePolicyRecord — which reconciles reminders (shifts
 * pending ones, cancels those no longer valid, never touches sent) via the
 * tested RPC, with an optimistic-lock check on the version.
 */
export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const policy = await getPolicyById(id);
  if (!policy) notFound();

  const clients = await getClients();

  async function submit(values: PolicyFormValues) {
    'use server';
    const base = {
      client_id: values.client_id,
      policy_type: values.policy_type,
      start_date: values.start_date,
      end_date: values.end_date,
    };
    const shape =
      values.policy_type === 'travel'
        ? { ...base, destination: values.destination }
        : { ...base, renewal_date: values.renewal_date };

    return updatePolicyRecord({
      id: policy!.id,
      expected_version: policy!.version,
      status: policy!.status,
      policy: shape,
    });
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit policy</h1>
        <p className="text-sm text-muted-foreground">
          Changing dates re-schedules this policy&apos;s pending reminders automatically.
        </p>
      </div>
      <PolicyForm
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        lockedClientId={policy.client_id}
        initial={{
          client_id: policy.client_id,
          policy_type: policy.policy_type,
          destination: policy.destination ?? '',
          start_date: policy.start_date,
          end_date: policy.end_date,
          renewal_date: policy.renewal_date ?? '',
        }}
        submitLabel="Save changes"
        successMessage="Policy updated and reminders re-scheduled."
        onSubmit={submit}
      />
    </main>
  );
}
