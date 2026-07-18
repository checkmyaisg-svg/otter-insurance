import { ClientPlatformBadge } from './ClientPlatformBadge';
import { formatDate } from '@/lib/format/display';
import type { ClientListItem } from '@/lib/data/clients';

/** A labeled field row used inside the detail card. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

/** Personal-details card for a single client. Presentational only. */
export function ClientDetailCard({ client }: { client: ClientListItem }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Full name" value={client.full_name} />
        <Field
          label="Phone"
          value={<span className="tabular-nums">{client.phone_number}</span>}
        />
        <Field label="Email" value={client.email || '—'} />
        <Field label="Birthday" value={formatDate(client.birthday)} />
        <Field
          label="Preferred platform"
          value={<ClientPlatformBadge platform={client.preferred_platform} />}
        />
        <Field label="Client since" value={formatDate(client.created_at)} />
      </dl>

      <div className="mt-6 border-t pt-5">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Notes
        </dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm">
          {client.notes ? client.notes : <span className="text-muted-foreground">No notes yet.</span>}
        </dd>
      </div>
    </div>
  );
}
