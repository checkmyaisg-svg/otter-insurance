'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { markPolicyRenewed, markPolicyLost } from '@/app/actions/outcomes';
import { Button } from '@/components/ui/button';
import { rollRenewalForward } from '@/lib/dates/renewal';
import { formatDate } from '@/lib/format/display';

/**
 * RENEWAL OUTCOME — the loop-closer. "Mark renewed" rolls the date forward
 * through the reconcile rails (reminders regenerate, urgency clears
 * everywhere at once). "Mark lost" cancels with a recorded reason. Inline
 * confirm; no dialog ceremony for a two-second action.
 */
export function RenewalOutcome({ policyId, renewalDate }: { policyId: string; renewalDate: string | null }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'idle' | 'renew' | 'lost'>('idle');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (!renewalDate) return null;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(true);
    setErr(null);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      setMode('idle');
      setReason('');
      router.refresh();
    } else {
      setErr(res.error ?? 'Something went wrong.');
    }
  };

  return (
    <div className="mt-4 rounded-lg bg-muted/40 p-3">
      {mode === 'idle' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-faint">Renewal outcome:</span>
          <Button size="sm" onClick={() => setMode('renew')}>Mark renewed</Button>
          <Button size="sm" variant="destructive" onClick={() => setMode('lost')}>Mark lost</Button>
        </div>
      ) : mode === 'renew' ? (
        <div className="ds-enter flex flex-wrap items-center gap-2">
          <span className="text-[13px]">
            Roll renewal forward to <span className="font-medium tabular-nums">{formatDate(rollRenewalForward(renewalDate))}</span>?
            <span className="text-muted-foreground"> Reminders regenerate for the new date.</span>
          </span>
          <Button size="sm" disabled={pending} onClick={() => void run(() => markPolicyRenewed(policyId))}>
            {pending ? 'Saving…' : 'Confirm renewed'}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      ) : (
        <div className="ds-enter flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why was it lost? (optional)"
            maxLength={300}
            autoFocus
            className="h-8 min-w-0 flex-1 rounded border !border-white/10 bg-background px-2.5 text-[13px] placeholder:text-faint focus-visible:!border-primary focus-visible:outline-none"
          />
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => void run(() => markPolicyLost(policyId, reason))}>
            {pending ? 'Saving…' : 'Confirm lost'}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      )}
      {err ? <p className="mt-1.5 text-[12.5px] text-destructive">{err}</p> : null}
    </div>
  );
}
