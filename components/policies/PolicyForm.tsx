'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/actions/result';

export type PolicyType = 'travel' | 'car' | 'home';

/** Minimal client option for the picker. */
export interface ClientOption {
  id: string;
  full_name: string;
}

/** The values PolicyForm manages. Mirrors the policy zod schema shape. */
export interface PolicyFormValues {
  client_id: string;
  policy_type: PolicyType;
  destination: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
}

const EMPTY: PolicyFormValues = {
  client_id: '',
  policy_type: 'travel',
  destination: '',
  start_date: '',
  end_date: '',
  renewal_date: '',
};

/**
 * Reusable, adaptive policy form. The visible fields change with policy_type:
 *   travel -> destination + departure + return
 *   car/home -> policy start + end + renewal date
 * Presentational + local state; the mutation is injected via onSubmit so no
 * business logic lives here. On success it shows a toast and redirects.
 */
export function PolicyForm({
  clients,
  lockedClientId,
  initial,
  submitLabel,
  successMessage,
  onSubmit,
}: {
  clients: ClientOption[];
  lockedClientId?: string; // when adding from a client's page, pre-select + lock
  initial?: Partial<PolicyFormValues>;
  submitLabel: string;
  successMessage: string;
  onSubmit: (values: PolicyFormValues) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState<PolicyFormValues>({
    ...EMPTY,
    ...(lockedClientId ? { client_id: lockedClientId } : {}),
    ...initial,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const isTravel = values.policy_type === 'travel';

  const set = (field: keyof PolicyFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  function validate(): string | null {
    if (!values.client_id) return 'Please choose a client.';
    if (!values.start_date) return isTravel ? 'Departure date is required.' : 'Policy start is required.';
    if (!values.end_date) return isTravel ? 'Return date is required.' : 'Policy end is required.';
    if (values.end_date < values.start_date) return 'End date cannot be before the start date.';
    if (isTravel && !values.destination.trim()) return 'Destination is required for travel.';
    if (!isTravel && !values.renewal_date) return 'Renewal date is required for car/home.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setPending(true);
    try {
      const result = await onSubmit(values);
      if (result.ok) {
        toast(successMessage, 'success');
        router.push('/policies');
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="client_id">
          Client <span className="text-destructive">*</span>
        </Label>
        <select
          id="client_id"
          value={values.client_id}
          onChange={set('client_id')}
          disabled={pending || !!lockedClientId}
          className={fieldClass}
        >
          <option value="" disabled>
            Choose a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="policy_type">
          Policy type <span className="text-destructive">*</span>
        </Label>
        <select
          id="policy_type"
          value={values.policy_type}
          onChange={set('policy_type')}
          disabled={pending}
          className={fieldClass}
        >
          <option value="travel">Travel</option>
          <option value="car">Car</option>
          <option value="home">Home</option>
        </select>
      </div>

      {isTravel ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="destination">
              Destination <span className="text-destructive">*</span>
            </Label>
            <Input
              id="destination"
              value={values.destination}
              onChange={set('destination')}
              placeholder="e.g. Tokyo, Japan"
              disabled={pending}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">
                Departure date <span className="text-destructive">*</span>
              </Label>
              <Input id="start_date" type="date" value={values.start_date} onChange={set('start_date')} disabled={pending} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">
                Return date <span className="text-destructive">*</span>
              </Label>
              <Input id="end_date" type="date" value={values.end_date} onChange={set('end_date')} disabled={pending} className={fieldClass} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Generates a bon-voyage message on departure and a welcome-home message on return.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">
                Policy start <span className="text-destructive">*</span>
              </Label>
              <Input id="start_date" type="date" value={values.start_date} onChange={set('start_date')} disabled={pending} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">
                Policy end <span className="text-destructive">*</span>
              </Label>
              <Input id="end_date" type="date" value={values.end_date} onChange={set('end_date')} disabled={pending} className={fieldClass} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renewal_date">
              Renewal date <span className="text-destructive">*</span>
            </Label>
            <Input id="renewal_date" type="date" value={values.renewal_date} onChange={set('renewal_date')} disabled={pending} className={fieldClass} />
            <p className="text-xs text-muted-foreground">
              Generates reminders 60, 30, and 7 days before this date.
            </p>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push('/policies')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
