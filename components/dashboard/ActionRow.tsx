import Link from 'next/link';
import type { TodayItem, TodayTone } from '@/lib/data/dashboard';

const DOT: Record<TodayTone, string> = {
  urgent: 'bg-destructive',
  warning: 'bg-amber-500',
  info: 'bg-primary',
  neutral: 'bg-muted-foreground',
};
const STATUS_STYLE: Record<TodayTone, string> = {
  urgent: 'text-destructive',
  warning: 'text-amber-600',
  info: 'text-primary',
  neutral: 'text-muted-foreground',
};

/**
 * One actionable row. Answers "why look at this?": client, reason, date, status,
 * one action. The whole row is a large tap target linking via `href` (the Action
 * View seam). On mobile the action label collapses to a chevron so the row never
 * cramps; on desktop the full "Action →" shows.
 */
export function ActionRow({ item }: { item: TodayItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
      >
        <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-full ${DOT[item.tone]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {item.clientName} <span className="font-normal text-muted-foreground">— {item.reason}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.dateLabel} · <span className={STATUS_STYLE[item.tone]}>{item.status}</span>
          </p>
        </div>
        {/* Desktop: full action label. Mobile: chevron. */}
        <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline">
          {item.actionLabel} →
        </span>
        <svg className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </li>
  );
}
