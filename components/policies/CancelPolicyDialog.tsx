'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cancelPolicyRecord } from '@/app/actions/policies';

/**
 * Cancel-policy control + confirmation. Cancelling sets the policy to
 * 'cancelled' and — via the tested reconcile in the RPC — cancels all its
 * pending reminders. Needs the current version for the optimistic-lock check,
 * plus the policy's core fields so the update RPC has a complete payload.
 */
export function CancelPolicyDialog({
  policyId,
  version,
  policy,
}: {
  policyId: string;
  version: number;
  policy: {
    client_id: string;
    policy_type: 'travel' | 'car' | 'home' | 'life' | 'health' | 'ci';
    destination: string | null;
    start_date: string;
    end_date: string | null;
    renewal_date: string | null;
    insurer: string | null;
    policy_number: string | null;
    premium_amount: number | null;
    payment_mode: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'single' | null;
    sum_assured: number | null;
    riders: Array<{ name: string; sum_assured?: number }>;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirmCancel() {
    setPending(true);
    try {
      // Rebuild the discriminated-union `policy` payload the schema expects.
      const money = {
        insurer: policy.insurer ?? undefined,
        policy_number: policy.policy_number ?? undefined,
        premium_amount: policy.premium_amount ?? undefined,
        payment_mode: policy.payment_mode ?? undefined,
        sum_assured: policy.sum_assured ?? undefined,
        riders: policy.riders,
      };
      const base = { client_id: policy.client_id, start_date: policy.start_date, ...money };
      const policyShape =
        policy.policy_type === 'travel'
          ? {
              ...base,
              policy_type: 'travel' as const,
              destination: policy.destination ?? '',
              end_date: policy.end_date ?? policy.start_date,
            }
          : policy.policy_type === 'life' || policy.policy_type === 'ci'
            ? {
                ...base,
                policy_type: policy.policy_type,
                ...(policy.end_date ? { end_date: policy.end_date } : {}),
              }
            : {
                ...base,
                policy_type: policy.policy_type,
                end_date: policy.end_date ?? policy.start_date,
                renewal_date: policy.renewal_date ?? '',
              };

      const result = await cancelPolicyRecord({
        id: policyId,
        expected_version: version,
        policy: policyShape,
      });
      if (result.ok) {
        toast('Policy cancelled. Pending reminders removed.', 'success');
        setOpen(false);
        router.refresh();
      } else {
        toast(result.error, 'error');
      }
    } catch {
      toast('Could not cancel policy. Please try again.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Cancel policy
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Cancel this policy?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The policy will be marked cancelled and any pending reminders for it will be
              removed. This can&apos;t be undone from here.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Keep policy
              </Button>
              <Button variant="destructive" onClick={confirmCancel} disabled={pending}>
                {pending ? 'Cancelling…' : 'Cancel policy'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
