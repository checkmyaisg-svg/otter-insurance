'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/actions/result';
import { PolicyTypeIcon } from '@/components/policies/PolicyTypeIcon';
import {
  ALL_POLICY_TYPES,
  POLICY_TYPE_LABEL,
  PAYMENT_MODE_LABEL,
  behaviorOf,
  type PolicyType,
  type PaymentMode,
} from '@/lib/policies/behavior';

/** Minimal client option for the picker. */
export interface ClientOption {
  id: string;
  full_name: string;
}

export interface RiderValue {
  name: string;
  sum_assured: string; // kept as string in form state; parsed on submit
}

/** Everything the form manages. Money fields are strings until submit. */
export interface PolicyFormValues {
  client_id: string;
  policy_type: PolicyType;
  destination: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
  insurer: string;
  policy_number: string;
  premium_amount: string;
  payment_mode: PaymentMode | '';
  sum_assured: string;
  riders: RiderValue[];
}

const EMPTY: PolicyFormValues = {
  client_id: '',
  policy_type: 'life',
  destination: '',
  start_date: '',
  end_date: '',
  renewal_date: '',
  insurer: '',
  policy_number: '',
  premium_amount: '',
  payment_mode: '',
  sum_assured: '',
  riders: [],
};

/** The submit payload shape (matches the zod discriminated union). */
export type PolicySubmitShape = Record<string, unknown>;

/**
 * Behavior-driven policy form. The 3x2 type grid selects a PolicyType; the
 * visible sections then follow its BEHAVIOR (protection / renewable / event),
 * not the type itself — so future types render correctly with zero form
 * changes. Money fields are optional everywhere: partial data never blocks a
 * save. Mobile-first: large tap targets, decimal keypads, sticky actions.
 */
export function PolicyForm({
  clients,
  lockedClientId,
  lockedType,
  initial,
  submitLabel,
  successMessage,
  onSubmit,
}: {
  clients: ClientOption[];
  lockedClientId?: string;
  /** when editing, the type cannot change (reminder semantics differ) */
  lockedType?: boolean;
  initial?: Partial<PolicyFormValues>;
  submitLabel: string;
  successMessage: string;
  onSubmit: (shape: PolicySubmitShape) => Promise<ActionResult<{ id: string }>>;
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

  const behavior = behaviorOf(values.policy_type);

  const set = (field: keyof PolicyFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const setRider = (i: number, field: keyof RiderValue, value: string) =>
    setValues((v) => {
      const riders = v.riders.slice();
      riders[i] = { ...riders[i]!, [field]: value };
      return { ...v, riders };
    });

  function validate(): string | null {
    if (!values.client_id) return 'Please choose a client.';
    if (!values.start_date)
      return behavior === 'event' ? 'Departure date is required.' : 'Policy start date is required.';
    if (behavior === 'event') {
      if (!values.destination.trim()) return 'Destination is required for travel.';
      if (!values.end_date) return 'Return date is required.';
    }
    if (behavior === 'renewable') {
      if (!values.end_date) return 'Policy end date is required.';
      if (!values.renewal_date) return 'Renewal date is required.';
    }
    if (values.end_date && values.end_date < values.start_date)
      return 'End date cannot be before the start date.';
    if (values.premium_amount && !(Number(values.premium_amount) > 0))
      return 'Premium must be a positive number.';
    if (values.sum_assured && !(Number(values.sum_assured) > 0))
      return 'Sum assured must be a positive number.';
    return null;
  }

  /** Build the exact discriminated-union shape the server schema expects. */
  function buildShape(): PolicySubmitShape {
    const money = {
      insurer: values.insurer.trim() || undefined,
      policy_number: values.policy_number.trim() || undefined,
      premium_amount: values.premium_amount ? Number(values.premium_amount) : undefined,
      payment_mode: values.payment_mode || undefined,
      sum_assured: values.sum_assured ? Number(values.sum_assured) : undefined,
      riders: values.riders
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          ...(r.sum_assured && Number(r.sum_assured) > 0
            ? { sum_assured: Number(r.sum_assured) }
            : {}),
        })),
    };
    const base = {
      client_id: values.client_id,
      policy_type: values.policy_type,
      start_date: values.start_date,
      ...money,
    };

    if (behavior === 'event') {
      return { ...base, destination: values.destination.trim(), end_date: values.end_date };
    }
    if (behavior === 'renewable') {
      return { ...base, end_date: values.end_date, renewal_date: values.renewal_date };
    }
    // protection: optional end date, no renewal
    return { ...base, ...(values.end_date ? { end_date: values.end_date } : {}) };
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
      const result = await onSubmit(buildShape());
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
    'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:h-10 sm:text-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Client */}
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

      {/* Type grid — 3x2 large tap targets */}
      <div className="space-y-1.5">
        <Label>
          Policy type <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {ALL_POLICY_TYPES.map((t) => {
            const active = values.policy_type === t;
            return (
              <button
                key={t}
                type="button"
                disabled={pending || (lockedType && !active)}
                onClick={() => setValues((v) => ({ ...v, policy_type: t }))}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-medium transition-all duration-150 disabled:opacity-40 ${
                  active
                    ? 'bg-card text-primary ring-2 ring-primary'
                    : 'bg-card text-muted-foreground !border-white/[0.06] border hover:ring-primary/40 hover:text-foreground'
                }`}
                aria-pressed={active}
              >
                <PolicyTypeIcon type={t} size={20} className={active ? 'text-primary' : 'text-muted-foreground'} />
                {POLICY_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
        {lockedType ? (
          <p className="text-xs text-muted-foreground">Policy type can&apos;t change after creation.</p>
        ) : null}
      </div>

      {/* Policy details */}
      <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
        <p className="mb-4 text-sm font-semibold">
          Policy details
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="insurer">Insurer</Label>
            <Input id="insurer" value={values.insurer} onChange={set('insurer')} placeholder="e.g. AIA" disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="policy_number">Policy number</Label>
            <Input id="policy_number" value={values.policy_number} onChange={set('policy_number')} placeholder="e.g. L-1234567" disabled={pending} />
          </div>
        </div>
      </div>

      {/* Coverage — behavior-driven */}
      <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
        <p className="mb-4 text-sm font-semibold">
          Coverage
        </p>

        {behavior === 'event' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="destination">
                Destination <span className="text-destructive">*</span>
              </Label>
              <Input id="destination" value={values.destination} onChange={set('destination')} placeholder="e.g. Tokyo, Japan" disabled={pending} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">
                  Departure <span className="text-destructive">*</span>
                </Label>
                <Input id="start_date" type="date" value={values.start_date} onChange={set('start_date')} disabled={pending} className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">
                  Return <span className="text-destructive">*</span>
                </Label>
                <Input id="end_date" type="date" value={values.end_date} onChange={set('end_date')} disabled={pending} className={fieldClass} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Generates a bon-voyage message on departure and a welcome-home message on return.
            </p>
          </div>
        ) : null}

        {behavior === 'renewable' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        ) : null}

        {behavior === 'protection' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">
                Policy start <span className="text-destructive">*</span>
              </Label>
              <Input id="start_date" type="date" value={values.start_date} onChange={set('start_date')} disabled={pending} className={fieldClass} />
              <p className="text-xs text-muted-foreground">
                Anchors premium due dates and the policy anniversary.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Coverage ends</Label>
              <Input id="end_date" type="date" value={values.end_date} onChange={set('end_date')} disabled={pending} className={fieldClass} />
              <p className="text-xs text-muted-foreground">Leave blank for whole-life cover.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Money */}
      <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
        <p className="mb-4 text-sm font-semibold">
          Premium &amp; cover
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="premium_amount">Premium (S$)</Label>
            <Input
              id="premium_amount"
              inputMode="decimal"
              value={values.premium_amount}
              onChange={set('premium_amount')}
              placeholder="e.g. 250.50"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_mode">Payment mode</Label>
            <select id="payment_mode" value={values.payment_mode} onChange={set('payment_mode')} disabled={pending} className={fieldClass}>
              <option value="">Not set</option>
              {(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABEL[m]}
                </option>
              ))}
            </select>
            {behavior === 'protection' ? (
              <p className="text-xs text-muted-foreground">
                Drives premium-due reminders. Leave unset to skip them.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sum_assured">Sum assured (S$)</Label>
            <Input
              id="sum_assured"
              inputMode="decimal"
              value={values.sum_assured}
              onChange={set('sum_assured')}
              placeholder="e.g. 500000"
              disabled={pending}
            />
          </div>
        </div>
      </div>

      {/* Riders */}
      <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riders</p>
          <button
            type="button"
            disabled={pending || values.riders.length >= 20}
            onClick={() => setValues((v) => ({ ...v, riders: [...v.riders, { name: '', sum_assured: '' }] }))}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-40"
          >
            + Add rider
          </button>
        </div>
        {values.riders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No riders added.</p>
        ) : (
          <div className="space-y-3">
            {values.riders.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={r.name}
                    onChange={(e) => setRider(i, 'name', e.target.value)}
                    placeholder="Rider name"
                    disabled={pending}
                    aria-label={`Rider ${i + 1} name`}
                  />
                </div>
                <div className="w-32 space-y-1.5 sm:w-40">
                  <Input
                    inputMode="decimal"
                    value={r.sum_assured}
                    onChange={(e) => setRider(i, 'sum_assured', e.target.value)}
                    placeholder="Sum (S$)"
                    disabled={pending}
                    aria-label={`Rider ${i + 1} sum assured`}
                  />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setValues((v) => ({ ...v, riders: v.riders.filter((_, j) => j !== i) }))}
                  aria-label={`Remove rider ${i + 1}`}
                  className="mt-2.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-20 flex items-center gap-3 rounded-xl bg-card/95 p-3 shadow-md ring-1 ring-black/5 backdrop-blur md:static md:bg-transparent md:p-0 md:shadow-none md:ring-0">
        <Button type="submit" disabled={pending} className="flex-1 md:flex-none">
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push('/policies')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
