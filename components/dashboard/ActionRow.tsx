import Link from 'next/link';
import type { TodayItem, TodayTone } from '@/lib/data/dashboard';
import { MessageDraft } from '@/components/whatsapp/MessageDraft';

/**
 * One actionable row — OPERATIONAL DENSITY (DS V2.1).
 * Single line, 36px: dot · client · reason · date · draft action.
 * Color budget: the tone dot is the ONLY color in a row (urgent rows add a red
 * status word). Typography carries hierarchy — weight for the client, muted
 * for the reason, tabular faint for the date. Everything scannable in one
 * horizontal eye-line; 30 tasks fit where 12 fit before.
 */
const DOT: Record<TodayTone, string> = {
  urgent: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-primary',
  neutral: 'bg-faint/60',
};

export function ActionRow({ item }: { item: TodayItem }) {
  return (
    <li className="group flex items-center">
      <Link
        href={item.href}
        className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded px-2 transition-colors duration-150 hover:bg-muted/60 max-sm:h-12"
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[item.tone]}`} aria-hidden />
        <span className="shrink-0 truncate text-[13.5px] font-medium text-foreground">
          {item.clientName}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {item.reason}
        </span>
        {item.tone === 'urgent' ? (
          <span className="shrink-0 text-[12px] font-medium text-destructive">{item.status}</span>
        ) : null}
        <time className="shrink-0 text-[12.5px] tabular-nums text-faint">{item.dateLabel}</time>
      </Link>
      {item.draft ? (
        <MessageDraft
          clientId={item.clientId}
          clientName={item.clientName}
          policyId={item.draft.policyId}
          phone={item.draft.phone}
          message={item.draft.message}
          compact
        />
      ) : null}
    </li>
  );
}
