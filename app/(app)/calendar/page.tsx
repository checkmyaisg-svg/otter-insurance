import Link from 'next/link';
import { getCalendarMonth } from '@/lib/data/calendar';
import { PageHeader } from '@/components/shell/PageHeader';
import { formatDate } from '@/lib/format/display';

export const dynamic = 'force-dynamic';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function sgToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * CALENDAR — Prospekt. A real month view over the reminder engine: every
 * marked day is an actual scheduled_message. Month nav is pure links
 * (?m=YYYY-MM); the grid is server-rendered — zero client JS.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = sgToday();
  const base = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : today.slice(0, 7);
  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7));

  const cal = await getCalendarMonth(year, month);
  const countByDate = new Map(cal.days.map((d) => [d.date, d.count]));

  // Grid math: Monday-first
  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${base}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <PageHeader title="Calendar" subtitle="Every scheduled reminder, on its day." />

      <div className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[15px] font-semibold tracking-tight">
            {MONTHS[month - 1]} <span className="text-muted-foreground">{year}</span>
          </p>
          <div className="flex items-center gap-1">
            <Link href={`/calendar?m=${prev}`} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground" aria-label="Previous month">‹</Link>
            <Link href="/calendar" className="flex h-7 items-center rounded px-2 text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">Today</Link>
            <Link href={`/calendar?m=${next}`} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground" aria-label="Next month">›</Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {DOW.map((d, i) => (
            <div key={i} className="pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{d}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const isToday = date === today;
            const count = countByDate.get(date) ?? 0;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5 py-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums ${
                    isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
                <span className={`h-1 w-1 rounded-full ${count > 0 ? 'bg-primary' : 'bg-transparent'}`} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="flex items-baseline gap-2 px-2 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">This month</span>
          <span className="text-[11px] tabular-nums text-faint">{cal.items.length}</span>
        </h2>
        {cal.items.length === 0 ? (
          <div className="ds-enter rounded-lg bg-muted/50 p-8 text-center">
            <p className="text-[13.5px] text-muted-foreground">No reminders scheduled this month.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {cal.items.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.policyId ? `/policies/${it.policyId}` : `/clients/${it.clientId}`}
                  className="flex h-9 min-w-0 items-center gap-2.5 rounded px-2 transition-colors duration-150 hover:bg-muted/60 max-sm:h-12"
                >
                  <time className="w-16 shrink-0 text-[12.5px] tabular-nums text-faint">{formatDate(it.date)}</time>
                  <span className="shrink-0 truncate text-[13.5px] font-medium">{it.clientName}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{it.label}</span>
                  <span className={`shrink-0 text-[12px] ${it.status === 'sent' ? 'text-primary' : 'text-faint'}`}>
                    {it.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
