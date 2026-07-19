import { notFound } from 'next/navigation';
import { getPolicyById } from '@/lib/data/policies';
import { getClients } from '@/lib/data/clients';
import { updatePolicyRecord } from '@/app/actions/policies';
import { PolicyForm, type PolicySubmitShape } from '@/components/policies/PolicyForm';
import { PageHeader } from '@/components/shell/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * Edit Policy page. Prefills the behavior-driven PolicyForm (type locked —
 * reminder semantics differ across behaviors) and wires updatePolicyRecord,
 * which reconciles reminders via the tested occurrence-aware algorithm.
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

  async function submit(shape: PolicySubmitShape) {
    'use server';
    return updatePolicyRecord({
      id: policy!.id,
      expected_version: policy!.version,
      status: policy!.status,
      policy: shape,
    });
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <PageHeader
        title="Edit policy"
        subtitle="Changing dates or payment mode re-schedules pending reminders automatically."
      />
      <PolicyForm
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        lockedClientId={policy.client_id}
        lockedType
        initial={{
          client_id: policy.client_id,
          policy_type: policy.policy_type,
          destination: policy.destination ?? '',
          start_date: policy.start_date,
          end_date: policy.end_date ?? '',
          renewal_date: policy.renewal_date ?? '',
          insurer: policy.insurer ?? '',
          policy_number: policy.policy_number ?? '',
          premium_amount: policy.premium_amount != null ? String(policy.premium_amount) : '',
          payment_mode: policy.payment_mode ?? '',
          sum_assured: policy.sum_assured != null ? String(policy.sum_assured) : '',
          riders: policy.riders.map((r) => ({
            name: r.name,
            sum_assured: r.sum_assured != null ? String(r.sum_assured) : '',
          })),
        }}
        submitLabel="Save changes"
        successMessage="Policy updated and reminders re-scheduled."
        onSubmit={submit}
      />
    </main>
  );
}
