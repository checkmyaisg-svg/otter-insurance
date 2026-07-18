import Link from 'next/link';
import { PolicyTypeBadge, PolicyStatusBadge } from './PolicyBadges';
import { formatDate } from '@/lib/format/display';
import type { PolicyListItem } from '@/lib/data/policies';

const TYPE_ICON: Record<string, string> = { travel: '✈️', car: '🚗', home: '🏠' };

/**
 * Policies ledger. A RECORD-first layout (type icon + coverage window + key date
 * + prominent status), distinct from the Clients people directory. Presentational.
 */
export function PolicyTable({
  policies,
  showClient = true,
}: {
  policies: PolicyListItem[];
  showClient?: boolean;
}) {
  if (policies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-12 text-center">
        <p className="text-sm font-medium">No policies yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Add a policy to start generating reminders.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {policies.map((p) => {
        const keyDate =
          p.policy_type === 'travel'
            ? { label: 'Returns', value: formatDate(p.end_date) }
            : { label: 'Renews', value: formatDate(p.renewal_date) };
        const coverage =
          p.policy_type === 'travel'
            ? (p.destination ?? '—')
            : `${formatDate(p.start_date)} – ${formatDate(p.end_date)}`;
        return (
          <li key={p.id}>
            <Link href={`/policies/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden>
                {TYPE_ICON[p.policy_type] ?? '📄'}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PolicyTypeBadge type={p.policy_type} />
                  {showClient ? <span className="truncate text-sm font-medium">{p.client_name}</span> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{coverage}</p>
              </div>

              <div className="hidden text-right sm:block">
                <p className="text-xs text-muted-foreground">{keyDate.label}</p>
                <p className="text-sm font-medium tabular-nums">{keyDate.value}</p>
              </div>

              <PolicyStatusBadge status={p.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
