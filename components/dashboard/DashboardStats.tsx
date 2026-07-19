import type { TodayData } from '@/lib/data/dashboard';

/** Understated stat strip below the header — quiet garnish, not the focus. */
export function DashboardStats({ stats }: { stats: TodayData['stats'] }) {
  const chips = [
    { label: 'Clients', value: stats.clients },
    { label: 'Active policies', value: stats.activePolicies },
    { label: 'Renewals this month', value: stats.renewalsThisMonth },
    { label: 'Reminders pending', value: stats.remindersPending },
  ];
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-baseline gap-1.5">
          <span className="font-semibold tabular-nums text-foreground">{c.value}</span>
          {c.label}
        </span>
      ))}
    </div>
  );
}
