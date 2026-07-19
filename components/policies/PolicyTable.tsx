import Link from 'next/link';
import { PolicyTypeBadge, PolicyStatusBadge } from './PolicyBadges';
import { formatDate } from '@/lib/format/display';
import type { PolicyListItem } from '@/lib/data/policies';

import { behaviorOf } from '@/lib/policies/behavior';
import { PolicyTypeIcon } from '@/components/policies/PolicyTypeIcon';
import type { PolicyType } from '@/lib/policies/behavior';

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
      <div className="rounded-lg bg-muted/60 bg-card p-12 text-center">
        <p className="text-sm font-medium">No policies yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Add a policy to start generating reminders.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]">
      {policies.map((p) => {
        const behavior = behaviorOf(p.policy_type as PolicyType);
        const keyDate =
          behavior === 'event'
            ? { label: 'Returns', value: formatDate(p.end_date) }
            : behavior === 'renewable'
              ? { label: 'Renews', value: formatDate(p.renewal_date) }
              : { label: 'Since', value: formatDate(p.start_date) };
        const coverage =
          behavior === 'event'
            ? (p.destination ?? '—')
            : behavior === 'renewable'
              ? `${formatDate(p.start_date)} – ${formatDate(p.end_date)}`
              : [p.insurer, p.policy_number].filter(Boolean).join(' · ') ||
                (p.sum_assured != null ? `S$${p.sum_assured.toLocaleString()} cover` : 'Protection');
        return (
          <li key={p.id}>
            <Link href={`/policies/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg" aria-hidden>
                <PolicyTypeIcon type={p.policy_type as PolicyType} size={18} className="text-muted-foreground" />
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
