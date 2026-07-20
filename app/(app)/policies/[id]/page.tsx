import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPolicyById, getRemindersForPolicy } from '@/lib/data/policies';
import { PolicyTypeBadge, PolicyStatusBadge } from '@/components/policies/PolicyBadges';
import { CancelPolicyDialog } from '@/components/policies/CancelPolicyDialog';
import { RenewalOutcome } from '@/components/policies/RenewalOutcome';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format/display';
import { behaviorOf, PAYMENT_MODE_LABEL } from '@/lib/policies/behavior';

export const dynamic = 'force-dynamic';

const REMINDER_LABEL: Record<string, string> = {
  travel_departure: 'Bon voyage message',
  travel_return: 'Welcome-home message',
  renewal_60: 'Renewal reminder (60 days)',
  renewal_30: 'Renewal reminder (30 days)',
  renewal_7: 'Renewal reminder (7 days)',
  premium_due: 'Premium due reminder',
  anniversary: 'Policy anniversary',
  manual: 'Manual message',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

const sgd = (n: number) => `S$${n.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Policy detail page — behavior-aware. Shows coverage per behavior, the money
 * fields, riders, and the reminders the scheduler generated (live).
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
  const behavior = behaviorOf(policy.policy_type);
  const isActive = policy.status === 'active';

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <div className="mb-6">
        <Link href="/policies" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to policies
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
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
                insurer: policy.insurer,
                policy_number: policy.policy_number,
                premium_amount: policy.premium_amount,
                payment_mode: policy.payment_mode,
                sum_assured: policy.sum_assured,
                riders: policy.riders,
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        {/* Coverage */}
        <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {policy.insurer ? <Field label="Insurer" value={policy.insurer} /> : null}
            {policy.policy_number ? (
              <Field label="Policy number" value={<span className="tabular-nums">{policy.policy_number}</span>} />
            ) : null}
            {behavior === 'event' ? (
              <>
                <Field label="Destination" value={policy.destination ?? '—'} />
                <Field label="Departs" value={formatDate(policy.start_date)} />
                <Field label="Returns" value={formatDate(policy.end_date)} />
              </>
            ) : null}
            {behavior === 'renewable' ? (
              <>
                <Field label="Policy start" value={formatDate(policy.start_date)} />
                <Field label="Policy end" value={formatDate(policy.end_date)} />
                <Field label="Renewal date" value={formatDate(policy.renewal_date)} />
              </>
            ) : null}
            {behavior === 'protection' ? (
              <>
                <Field label="Policy start" value={formatDate(policy.start_date)} />
                <Field
                  label="Coverage ends"
                  value={policy.end_date ? formatDate(policy.end_date) : 'Whole of life'}
                />
              </>
            ) : null}
          </dl>
          {isActive && behavior === 'renewable' ? (
            <RenewalOutcome policyId={policy.id} renewalDate={policy.renewal_date} />
          ) : null}
        </div>

        {/* Premium & cover */}
        {policy.premium_amount != null || policy.sum_assured != null || policy.payment_mode ? (
          <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
            <h2 className="mb-4 text-sm font-semibold">Premium &amp; cover</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {policy.premium_amount != null ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Premium</dt>
                  <dd className="text-[17px] font-semibold leading-6 tabular-nums tracking-tight">
                    {sgd(policy.premium_amount)}
                    {policy.payment_mode && policy.payment_mode !== 'single' ? (
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}/ {PAYMENT_MODE_LABEL[policy.payment_mode].toLowerCase()}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {policy.payment_mode ? (
                <Field label="Payment mode" value={PAYMENT_MODE_LABEL[policy.payment_mode]} />
              ) : null}
              {policy.sum_assured != null ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sum assured</dt>
                  <dd className="text-[17px] font-semibold leading-6 tabular-nums tracking-tight">{sgd(policy.sum_assured)}</dd>
                </div>
              ) : null}
            </dl>
            {policy.riders.length > 0 ? (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Riders
                </p>
                <ul className="space-y-1.5">
                  {policy.riders.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>{r.name}</span>
                      {r.sum_assured != null ? (
                        <span className="tabular-nums text-muted-foreground">{sgd(r.sum_assured)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Generated reminders */}
        <section className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
          <h2 className="mb-4 text-sm font-semibold">Generated reminders</h2>
          {reminders.length === 0 ? (
            <div className="rounded-lg bg-muted/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No reminders scheduled — dates may be in the past, or payment mode isn&apos;t set.
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
                  <time className="text-sm tabular-nums text-muted-foreground">{formatDate(r.scheduled_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
