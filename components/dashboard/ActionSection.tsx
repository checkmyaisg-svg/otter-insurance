import { ActionRow } from './ActionRow';
import type { TodaySection } from '@/lib/data/dashboard';

/**
 * A dashboard section. Renders nothing when empty (no wall of empty headers).
 * Presentational — receives a built section from the engine.
 */
export function ActionSection({ section }: { section: TodaySection }) {
  if (section.items.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
        <span aria-hidden>{section.emoji}</span>
        {section.title}
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {section.items.length}
        </span>
      </h2>
      <ul className="divide-y">
        {section.items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
