import { TimelineEventRow } from './TimelineEventRow';
import type { TimelineEvent } from '@/lib/data/timeline';

/**
 * The customer journey timeline. Splits events into "Upcoming" (scheduled,
 * future) and "History" (already happened) so the agent immediately sees what
 * will happen next vs what already did. Presentational — receives built events.
 */
export function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No timeline events yet. Add a policy to start this client&apos;s journey.
        </p>
      </div>
    );
  }

  const upcoming = events.filter((e) => e.scheduled).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const history = events.filter((e) => !e.scheduled);

  return (
    <div className="space-y-6">
      {upcoming.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming
          </h3>
          <ul>
            {upcoming.map((e) => (
              <TimelineEventRow key={e.id} event={e} />
            ))}
          </ul>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h3>
          <ul>
            {history.map((e) => (
              <TimelineEventRow key={e.id} event={e} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
