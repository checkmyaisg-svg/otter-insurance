import Link from 'next/link';
import { PolicyTypeBadge, PolicyStatusBadge } from '@/components/policies/PolicyBadges';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format/display';
import type { PolicyListItem } from '@/lib/data/policies';

/**
 * Policies section for the client detail page. Presentational: lists the
 * client's policies with a link to add another (client pre-locked). Real data
 * now replaces the earlier placeholder.
 */
export function ClientPoliciesSection({
  clientId,
  policies,
}: {
  clientId: string;
  policies: PolicyListItem[];
}) {
  return (
    <section className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Policies</h2>
        <Button asChild variant="outline" size="sm">
          <Link href={`/policies/new?client=${clientId}`}>Add policy</Link>
        </Button>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">No policies yet.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <PolicyTypeBadge type={p.policy_type} />
                <span className="text-sm text-muted-foreground">
                  {p.policy_type === 'travel'
                    ? (p.destination ?? '—')
                    : p.renewal_date
                      ? `Renews ${formatDate(p.renewal_date)}`
                      : [p.insurer, p.policy_number].filter(Boolean).join(' · ') || 'Protection'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <PolicyStatusBadge status={p.status} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/policies/${p.id}`}>View</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
