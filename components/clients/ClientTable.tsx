import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { ClientPlatformBadge } from './ClientPlatformBadge';
import { formatDate } from '@/lib/format/display';
import type { ClientListItem } from '@/lib/data/clients';

/**
 * Clients directory — people-first (avatar + name), distinct from the Policies
 * ledger. The whole row is a large tap target linking to the client. Detail
 * columns (policies/platform/birthday) show on sm+ and collapse on mobile; a
 * single chevron sits at the end at all widths. Kept deliberately simple so no
 * element can double-render and overflow the row.
 */
export function ClientTable({
  clients,
  renderDelete,
  hasSearch,
}: {
  clients: ClientListItem[];
  renderDelete: (client: ClientListItem) => React.ReactNode;
  hasSearch: boolean;
}) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-12 text-center">
        <p className="text-sm font-medium">
          {hasSearch ? 'No clients match your search.' : 'No clients yet.'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasSearch ? 'Try a different name or phone number.' : 'Add your first client to get started.'}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {clients.map((c) => (
        <li key={c.id} className="group relative flex items-center">
          <Link href={`/clients/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
            <Avatar name={c.full_name} className="h-11 w-11 text-sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="tabular-nums">{c.phone_number}</span>
                {c.email ? ` · ${c.email}` : ''}
              </p>
            </div>

            {/* Detail columns — desktop only */}
            <div className="hidden shrink-0 items-center gap-6 md:flex">
              <div className="w-14 text-right">
                <p className="text-xs text-muted-foreground">Policies</p>
                <p className="text-sm font-medium tabular-nums">{c.policy_count}</p>
              </div>
              <ClientPlatformBadge platform={c.preferred_platform} />
              <div className="w-24 text-right">
                <p className="text-xs text-muted-foreground">Birthday</p>
                <p className="text-sm tabular-nums">{formatDate(c.birthday)}</p>
              </div>
            </div>

            <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

          {/* Desktop hover actions, overlaid over the chevron area */}
          <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
            <Link
              href={`/clients/${c.id}/edit`}
              className="rounded-md bg-card px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border hover:bg-muted hover:text-foreground"
            >
              Edit
            </Link>
            {renderDelete(c)}
          </div>
        </li>
      ))}
    </ul>
  );
}
