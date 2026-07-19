import Link from 'next/link';
import { getAgent } from '@/lib/actions/auth';
import { PageHeader } from '@/components/shell/PageHeader';
import { formatDate } from '@/lib/format/display';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  renewal_30: 'Renewal reminder',
  renewal_7: 'Renewal reminder (7 days)',
  premium_due: 'Premium due reminder',
  policy_anniversary: 'Anniversary message',
  travel_departure: 'Travel check-in',
  travel_return: 'Welcome-home message',
  manual: 'WhatsApp message',
};

type Tab = 'all' | 'scheduled' | 'sent';

/**
 * MESSAGES — Prospekt. The message ledger: everything the reminder engine has
 * scheduled and everything already sent (including WhatsApp drafts you opened).
 * Real rows from scheduled_messages; tabs are links (?tab=), zero client JS.
 * Composing/threads arrive with the WhatsApp Business connection (V0.3).
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === 'scheduled' || rawTab === 'sent' ? rawTab : 'all';

  const { supabase, userId } = await getAgent();
  const rows = userId
    ? (
        await supabase
          .from('scheduled_messages')
          .select('id, client_id, policy_id, message_type, scheduled_at, status, template_name, clients(full_name)')
          .in('status', ['pending', 'sent'])
          .order('scheduled_at', { ascending: false })
          .limit(100)
      ).data ?? []
    : [];

  const items = rows
    .map((r) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      policyId: (r.policy_id as string | null) ?? null,
      clientName: ((r.clients as { full_name?: string } | null)?.full_name as string) ?? 'Client',
      label:
        r.message_type === 'manual' && (r.template_name as string | null)?.startsWith('wa_draft')
          ? 'WhatsApp message'
          : TYPE_LABEL[r.message_type as string] ?? (r.message_type as string),
      date: (r.scheduled_at as string).slice(0, 10),
      status: r.status as 'pending' | 'sent',
    }))
    .filter((it) => (tab === 'all' ? true : tab === 'scheduled' ? it.status === 'pending' : it.status === 'sent'));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'sent', label: 'Sent' },
  ];

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <PageHeader title="Messages" subtitle="Everything scheduled and everything sent." />

      <div className="mb-4 flex items-center gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/messages' : `/messages?tab=${t.key}`}
            className={`flex h-7 items-center rounded px-2.5 text-[12.5px] transition-colors duration-150 ${
              tab === t.key ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="ds-enter rounded-lg bg-muted/50 p-8 text-center">
          <p className="text-[13.5px] font-medium">Nothing here yet.</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Add a policy and its reminders will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.policyId ? `/policies/${it.policyId}` : `/clients/${it.clientId}`}
                className="flex h-9 min-w-0 items-center gap-2.5 rounded px-2 transition-colors duration-150 hover:bg-muted/60 max-sm:h-12"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.status === 'sent' ? 'bg-primary' : 'bg-faint/60'}`}
                  aria-hidden
                />
                <span className="shrink-0 truncate text-[13.5px] font-medium">{it.clientName}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{it.label}</span>
                <span className={`shrink-0 text-[12px] ${it.status === 'sent' ? 'text-primary' : 'text-faint'}`}>
                  {it.status === 'sent' ? 'Sent' : 'Scheduled'}
                </span>
                <time className="shrink-0 text-[12.5px] tabular-nums text-faint">{formatDate(it.date)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
