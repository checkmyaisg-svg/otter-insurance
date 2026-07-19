import type { TodayData } from '@/lib/data/dashboard';

/**
 * Assistant-style header. Greets the agent by name and summarizes the day in a
 * human sentence ("2 urgent, 3 follow-ups…") rather than dumping stats.
 */
export function DashboardHeader({ data }: { data: TodayData }) {
  const { agentName, summary } = data;
  const parts: string[] = [];
  if (summary.urgent > 0) parts.push(`${summary.urgent} ${summary.urgent === 1 ? 'thing needs' : 'things need'} your attention`);
  if (summary.followUps > 0) parts.push(`${summary.followUps} ${summary.followUps === 1 ? 'follow-up' : 'follow-ups'}`);
  if (summary.scheduledToday > 0) parts.push(`${summary.scheduledToday} ${summary.scheduledToday === 1 ? 'reminder' : 'reminders'} going out`);

  const hour = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const sentence =
    parts.length === 0
      ? "You're all caught up — nothing needs you right now."
      : `Here's what's on your plate today: ${joinNaturally(parts)}.`;

  return (
    <div className="mb-8">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {new Date(Date.now() + 8 * 3600 * 1000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {greeting}, {agentName}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{sentence}</p>
    </div>
  );
}

function joinNaturally(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
