import { getAgent } from '@/lib/actions/auth';

export interface CalendarItem {
  id: string;
  date: string; // YYYY-MM-DD
  clientName: string;
  clientId: string;
  policyId: string | null;
  label: string;
  status: string;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  days: { date: string; count: number }[];
  items: CalendarItem[]; // month's items, date-ascending
}

const TYPE_LABEL: Record<string, string> = {
  renewal_30: 'Renewal reminder (30 days)',
  renewal_7: 'Renewal reminder (7 days)',
  premium_due: 'Premium due reminder',
  policy_anniversary: 'Policy anniversary',
  travel_departure: 'Travel departure check-in',
  travel_return: 'Welcome-home message',
  manual: 'WhatsApp message',
};

/**
 * CALENDAR — a real month view derived from the reminder engine's rows.
 * No new tables, no fake data: every dot on the grid is a scheduled_message.
 */
export async function getCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const { supabase, userId } = await getAgent();
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const empty: CalendarMonth = { year, month, days: [], items: [] };
  if (!userId) return empty;

  const { data } = await supabase
    .from('scheduled_messages')
    .select('id, client_id, policy_id, message_type, scheduled_at, status, clients(full_name)')
    .gte('scheduled_at', first)
    .lt('scheduled_at', nextMonth)
    .order('scheduled_at', { ascending: true });

  const items: CalendarItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    date: (r.scheduled_at as string).slice(0, 10),
    clientName: ((r.clients as { full_name?: string } | null)?.full_name as string) ?? 'Client',
    clientId: r.client_id as string,
    policyId: (r.policy_id as string | null) ?? null,
    label: TYPE_LABEL[r.message_type as string] ?? (r.message_type as string),
    status: r.status as string,
  }));

  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.date, (counts.get(it.date) ?? 0) + 1);

  return {
    year,
    month,
    days: [...counts.entries()].map(([date, count]) => ({ date, count })),
    items,
  };
}
