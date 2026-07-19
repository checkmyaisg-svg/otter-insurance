import { ActionRow } from './ActionRow';
import type { TodaySection } from '@/lib/data/dashboard';

/**
 * A dashboard section — DS V2.1 "Mission Control" layout.
 *
 * NO card wrappers: lists render on the canvas under typographic headers
 * (label-type + tabular count). This is the widgets->work-queue shift: boxes
 * exist only where something must be SET APART, and exactly one thing
 * qualifies — the urgent section, which gets the screen's single tinted
 * surface. Color budget per screen: urgent tint, tone dots, one primary
 * button. Everything else is typography and spacing.
 */
export function ActionSection({ section }: { section: TodaySection }) {
  if (section.items.length === 0) return null;
  const urgent = section.key === 'attention';

  const header = (
    <h2 className="flex items-baseline gap-2 px-2 pb-1.5">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wider ${
          urgent ? 'text-destructive' : 'text-faint'
        }`}
      >
        {section.title}
      </span>
      <span className="text-[11px] tabular-nums text-faint">{section.items.length}</span>
    </h2>
  );

  const list = (
    <ul className="divide-y divide-white/[0.04]">
      {section.items.map((item) => (
        <ActionRow key={item.id} item={item} />
      ))}
    </ul>
  );

  if (urgent) {
    return (
      <section className="-mx-2 rounded-lg bg-destructive/[0.06] px-2 pb-1.5 pt-2.5">
        {header}
        {list}
      </section>
    );
  }
  return (
    <section className="pt-1.5">
      {header}
      {list}
    </section>
  );
}
