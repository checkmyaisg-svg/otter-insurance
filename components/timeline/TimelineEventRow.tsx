import { formatDate } from '@/lib/format/display';
import type { TimelineEvent, TimelineTone } from '@/lib/data/timeline';

const TONE_DOT: Record<TimelineTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-destructive',
  muted: 'bg-border',
};

/**
 * Renders a single timeline event. Presentational and kind-agnostic: it reads
 * the event's tone/title/detail, so adding a NEW event kind later requires no
 * change here — the builder just emits a new event with a title + tone.
 */
export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* connector line */}
      <div className="absolute left-[5px] top-3 h-full w-px bg-border last:hidden" aria-hidden />
      <span
        className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[event.tone]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{event.title}</p>
          <time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.at)}</time>
        </div>
        {event.detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
        ) : null}
      </div>
    </li>
  );
}
