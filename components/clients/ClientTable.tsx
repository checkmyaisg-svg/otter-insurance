import Link from 'next/link';
import { IconChevronRight } from '@/components/ui/icons';
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
      <div className="rounded-lg bg-muted/60 bg-card p-12 text-center">
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
    <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]">
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
          </Link>

          {/* Desktop actions: IN-FLOW with permanently reserved space — nothing
              overlaps data. Fade on hover is opacity-only; layout never shifts.
              (Regression guard: never absolutely position actions over columns.) */}
          <div className="hidden shrink-0 items-center gap-1 pr-2 md:flex">
            <Link
              href={`/clients/${c.id}/edit`}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              Edit
            </Link>
            <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {renderDelete(c)}
            </span>
          </div>

          {/* Chevron: mobile-only affordance (desktop shows actions instead) */}
          <Link href={`/clients/${c.id}`} aria-hidden tabIndex={-1} className="pr-4 md:hidden">
            <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
