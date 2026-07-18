import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPolicyById, getRemindersForPolicy } from '@/lib/data/policies';
import { PolicyTypeBadge, PolicyStatusBadge } from '@/components/policies/PolicyBadges';
import { CancelPolicyDialog } from '@/components/policies/CancelPolicyDialog';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format/display';

export const dynamic = 'force-dynamic';

const REMINDER_LABEL: Record<string, string> = {
  travel_departure: 'Bon voyage message',
  travel_return: 'Welcome-home message',
  renewal_60: 'Renewal reminder (60 days)',
  renewal_30: 'Renewal reminder (30 days)',
  renewal_7: 'Renewal reminder (7 days)',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

/**
 * Policy detail page. Shows the policy's fields, its client, and the reminders
 * it generated (live from the scheduler). Edit + Cancel act on the tested
 * server actions; cancelling reconciles/removes pending reminders.
 */
export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const policy = await getPolicyById(id);
  if (!policy) notFound();

  const reminders = await getRemindersForPolicy(id);
  const isTravel = policy.policy_type === 'travel';
  const isActive = policy.status === 'active';

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-6">
        <Link href="/policies" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to policies
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            <Link href={`/clients/${policy.client_id}`} className="hover:text-primary hover:underline">
              {policy.client_name}
            </Link>
          </h1>
          <PolicyTypeBadge type={policy.policy_type} />
          <PolicyStatusBadge status={policy.status} />
        </div>
        {isActive ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/policies/${policy.id}/edit`}>Edit</Link>
            </Button>
            <CancelPolicyDialog
              policyId={policy.id}
              version={policy.version}
              policy={{
                client_id: policy.client_id,
                policy_type: policy.policy_type,
                destination: policy.destination,
                start_date: policy.start_date,
                end_date: policy.end_date,
                renewal_date: policy.renewal_date,
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Policy type" value={<PolicyTypeBadge type={policy.policy_type} />} />
            <Field label="Status" value={<PolicyStatusBadge status={policy.status} />} />
            {isTravel ? (
              <>
                <Field label="Destination" value={policy.destination ?? '—'} />
                <Field label="Departs" value={formatDate(policy.start_date)} />
                <Field label="Returns" value={formatDate(policy.end_date)} />
              </>
            ) : (
              <>
                <Field label="Policy start" value={formatDate(policy.start_date)} />
                <Field label="Policy end" value={formatDate(policy.end_date)} />
                <Field label="Renewal date" value={formatDate(policy.renewal_date)} />
              </>
            )}
          </dl>
        </div>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Generated reminders</h2>
          {reminders.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No reminders scheduled — the relevant dates may already be in the past.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{REMINDER_LABEL[r.message_type] ?? r.message_type}</p>
                    <p className="text-xs text-muted-foreground">Status: {r.status}</p>
                  </div>
                  <time className="text-sm text-muted-foreground">{formatDate(r.scheduled_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
