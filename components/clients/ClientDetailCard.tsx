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
    <div className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-4">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Birthday" value={formatDate(client.birthday)} />
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
