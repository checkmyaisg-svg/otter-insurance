import Link from 'next/link';
import { getRevenueReport } from '@/lib/data/revenue';
import { PageHeader } from '@/components/shell/PageHeader';
import { formatDate } from '@/lib/format/display';

export const dynamic = 'force-dynamic';

const sgd = (n: number) => `S$${n.toLocaleString('en-SG')}`;

/**
 * REVENUE INTELLIGENCE — where the advisor's income is, and which of it is at
 * risk. Three honest numbers (book value, 90-day pipeline, at-risk) and the
 * pipeline itself, risk-annotated. Every figure sums recorded premiums;
 * commissions derive from these, and we say so instead of guessing rates.
 */
export default async function RevenuePage() {
  const r = await getRevenueReport();
  if (!r) return null;

  const stat = (label: string, value: string, tone?: 'danger') => (
    <div className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${tone === 'danger' ? 'text-destructive' : ''}`}>
        {value}
      </p>
    </div>
  );

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <PageHeader
        title="Revenue"
        subtitle="Annualized from recorded premiums — the figures your commissions derive from."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stat('Active book / year', sgd(r.bookAnnualValue))}
        {stat('Renewing in 90 days', sgd(r.pipelineTotal))}
        {stat('At risk', sgd(r.atRiskTotal), r.atRiskTotal > 0 ? 'danger' : undefined)}
      </div>

      {r.bookMissingPremiums > 0 ? (
        <p className="mt-3 px-1 text-[12.5px] text-faint">
          {r.bookMissingPremiums} active polic{r.bookMissingPremiums === 1 ? 'y has' : 'ies have'} no premium recorded —
          add them to make these figures complete.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="flex items-baseline gap-2 px-2 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Renewal pipeline · 90 days</span>
          <span className="text-[11px] tabular-nums text-faint">{r.pipeline90.length}</span>
        </h2>
        {r.pipeline90.length === 0 ? (
          <div className="ds-enter rounded-lg bg-muted/50 p-8 text-center">
            <p className="text-[13.5px] text-muted-foreground">No renewals inside 90 days.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {r.pipeline90.map((row) => (
              <li key={row.policyId}>
                <Link
                  href={`/policies/${row.policyId}`}
                  className="flex h-9 min-w-0 items-center gap-2.5 rounded px-2 transition-colors duration-150 hover:bg-muted/60 max-sm:h-12"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.atRisk ? 'bg-destructive' : 'bg-primary'}`}
                    aria-hidden
                  />
                  <span className="shrink-0 truncate text-[13.5px] font-medium">{row.clientName}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                    {row.policyLabel} · {row.premiumLabel}
                    {row.riskReason ? <span className="text-destructive"> · {row.riskReason}</span> : null}
                  </span>
                  <time className="shrink-0 text-[12.5px] tabular-nums text-faint">{formatDate(row.renewalDate)}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
