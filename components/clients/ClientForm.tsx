'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/actions/result';

/** The values ClientForm manages. Matches the server action's zod schema. */
export interface ClientFormValues {
  full_name: string;
  phone_number: string;
  email: string;
  birthday: string;
  preferred_platform: 'whatsapp' | 'wechat' | 'telegram';
  occupation: string;
  dependants: string; // numeric input as string
  notes: string;
}

const EMPTY: ClientFormValues = {
  full_name: '',
  phone_number: '',
  email: '',
  birthday: '',
  preferred_platform: 'whatsapp',
  occupation: '',
  dependants: '',
  notes: '',
};

/**
 * Reusable client form (Add now, Edit later). Presentational + local state:
 * the actual mutation is injected via `onSubmit`, so this component never
 * imports business logic. Shows a loading state while the action runs and an
 * inline error banner on failure; success behavior (toast + redirect) is
 * handled here since it's identical for add and edit.
 */
export function ClientForm({
  initial,
  submitLabel,
  successMessage,
  onSubmit,
}: {
  initial?: Partial<ClientFormValues>;
  submitLabel: string;
  successMessage: string;
  onSubmit: (values: ClientFormValues) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState<ClientFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const set = (field: keyof ClientFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Guard: birthday must be a 4-digit year, within a sane range, and not in the future.
    if (values.birthday) {
      const match = /^(\d{4})-\d{2}-\d{2}$/.exec(values.birthday);
      if (!match) {
        setError('Enter a valid birthday (year must be 4 digits).');
        return;
      }
      const year = Number(match[1]);
      if (year < 1900) {
        setError('Please enter a realistic birth year (1900 or later).');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (values.birthday > today) {
        setError('Birthday cannot be in the future.');
        return;
      }
    }

    setPending(true);
    try {
      const result = await onSubmit(values);
      if (result.ok) {
        toast(successMessage, 'success');
        router.push('/clients');
        router.refresh(); // ensure the list re-reads and shows the change
      } else {
        setError(result.error);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="full_name">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          value={values.full_name}
          onChange={set('full_name')}
          placeholder="e.g. Tan Wei Ming"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone_number">
          Phone number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="phone_number"
          value={values.phone_number}
          onChange={set('phone_number')}
          placeholder="e.g. 9123 4567"
          required
          disabled={pending}
          inputMode="tel"
        />
        <p className="text-xs text-muted-foreground">
          Singapore numbers — 8 digits, with or without +65.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={set('email')}
            placeholder="optional"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthday">Birthday</Label>
          <Input
            id="birthday"
            type="date"
            value={values.birthday}
            onChange={set('birthday')}
            disabled={pending}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferred_platform">Preferred platform</Label>
        <select
          id="preferred_platform"
          value={values.preferred_platform}
          onChange={set('preferred_platform')}
          disabled={pending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="wechat">WeChat (coming soon)</option>
          <option value="telegram">Telegram (coming soon)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Only WhatsApp sends are active in this version.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="occupation">Occupation</Label>
          <Input
            id="occupation"
            type="text"
            value={values.occupation}
            onChange={set('occupation')}
            disabled={pending}
            placeholder="e.g. Teacher"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dependants">Dependants</Label>
          <Input
            id="dependants"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={values.dependants}
            onChange={set('dependants')}
            disabled={pending}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={values.notes}
          onChange={set('notes')}
          placeholder="Anything worth remembering about this client…"
          disabled={pending}
          rows={4}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push('/clients')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
