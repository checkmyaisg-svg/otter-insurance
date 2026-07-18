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
    <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {chips.map((c) => (
        <div key={c.label} className="bg-card px-4 py-3.5">
          <div className="text-xl font-semibold tabular-nums">{c.value}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
