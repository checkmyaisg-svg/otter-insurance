import Link from 'next/link';
import type { Briefing } from '@/lib/intelligence/briefing';

/**
 * MORNING BRIEFING — the assistant speaks first.
 * Sits above all sections on Today: what matters, in money and names, plus
 * "spend the next hour on these". Flat, dense, DS-lawful: dots for severity,
 * money in money-type, one urgent surface max (the insights carry their own
 * weight through typography, not boxes).
 */
const DOT: Record<string, string> = {
  urgent: 'bg-destructive',
  notice: 'bg-warning',
  info: 'bg-primary',
};

export function MorningBriefing({ briefing }: { briefing: Briefing }) {
  if (briefing.insights.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl bg-card p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]">
      <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        Morning briefing
      </h2>

      <ul className="space-y-3">
        {briefing.insights.map((ins) => (
          <li key={ins.key} className="flex gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[ins.severity]}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium leading-5">{ins.headline}</p>
              <p className="mt-0.5 text-[12.5px] leading-4 text-muted-foreground">{ins.detail}</p>
              {ins.clients.length > 0 ? (
                <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  {ins.clients.slice(0, 6).map((c) => (
                    <Link
                      key={c.id}
                      href={`/clients/${c.id}`}
                      className="text-[12.5px] text-primary transition-colors duration-150 hover:underline"
                    >
                      {c.name}
                    </Link>
                  ))}
                  {ins.clients.length > 6 ? (
                    <span className="text-[12.5px] text-faint">+{ins.clients.length - 6} more</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {briefing.focus.length > 0 ? (
        <div className="mt-4 border-t !border-white/[0.06] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            If you have one hour today
          </p>
          <ol className="mt-1.5 space-y-1">
            {briefing.focus.map((f, i) => (
              <li key={f.clientId}>
                <Link
                  href={`/clients/${f.clientId}`}
                  className="group flex items-baseline gap-2 rounded px-1 py-0.5 transition-colors duration-150 hover:bg-muted/60"
                >
                  <span className="w-4 shrink-0 text-[12px] tabular-nums text-faint">{i + 1}.</span>
                  <span className="shrink-0 text-[13.5px] font-medium group-hover:text-primary">{f.clientName}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{f.reason}</span>
                  {f.valueAtStake > 0 ? (
                    <span className="shrink-0 text-[12.5px] font-medium tabular-nums">
                      S${f.valueAtStake.toLocaleString('en-SG')}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
