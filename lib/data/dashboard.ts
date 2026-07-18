import { createClient } from '@/lib/supabase/server';

/**
 * DASHBOARD ENGINE (Task Engine, V1 — derived)
 *
 * This module owns ALL business logic for the Today dashboard. The page is a
 * pure renderer. Every actionable item is a `TodayItem` with a stable shape:
 * a reason ("why look at this?"), the client, a date, a status, one action, and
 * an `href`. The href is the ACTION VIEW SEAM — today it points at the client
 * or policy record; later it can point at a focused task workspace with NO
 * change to the dashboard renderer.
 *
 * V1 items are derived from policies + scheduled_messages. V2 kinds (replies,
 * payments, persisted tasks) are intentionally NOT produced and NOT shown.
 */

export type TodayTone = 'urgent' | 'warning' | 'info' | 'neutral';

export type TodayItemKind =
  | 'overdue_renewal'
  | 'failed_message'
  | 'renewal_follow_up'
  | 'scheduled_today'
  | 'travel_departure'
  | 'upcoming_renewal';

export interface TodayItem {
  id: string;
  kind: TodayItemKind;
  clientId: string;
  clientName: string;
  /** Why the agent needs to look at this — the row's headline reason. */
  reason: string;
  /** The relevant date, preformatted for display. */
  dateLabel: string;
  /** Short status word (e.g. "Overdue", "Pending", "In 5 days"). */
  status: string;
  /** The one clear action label (e.g. "Review renewal"). */
  actionLabel: string;
  /** Where the action goes. ACTION VIEW SEAM — swap target later, no UI change. */
  href: string;
  tone: TodayTone;
}

export interface TodaySection {
  key: string;
  title: string;
  emoji: string;
  items: TodayItem[];
}

export interface TodayData {
  agentName: string;
  stats: { clients: number; activePolicies: number; renewalsThisMonth: number; remindersPending: number };
  summary: { urgent: number; followUps: number; scheduledToday: number };
  sections: TodaySection[];
}

// --- date helpers (Asia/Singapore is UTC+8, fixed; we compare calendar days) ---
function todayYmd(): string {
  // "Now" in SGT as a YYYY-MM-DD string.
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgt.toISOString().slice(0, 10);
}
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
function fmt(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function relativeStatus(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/**
 * Build the entire Today dashboard for the current agent. RLS scopes every
 * query to this agent, so no agent_id filters are needed. Returns everything the
 * renderer needs; the renderer computes nothing.
 */
export async function getToday(): Promise<TodayData> {
  const supabase = await createClient();
  const today = todayYmd();
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);
  const monthEnd = addDays(today, 31);

  const [{ data: userData }, clientsRes, policiesRes, remindersRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('policies')
      .select('id, client_id, policy_type, destination, start_date, end_date, renewal_date, status, clients(full_name)')
      .eq('status', 'active'),
    supabase
      .from('scheduled_messages')
      .select('id, client_id, policy_id, message_type, scheduled_at, status, clients(full_name)'),
  ]);

  const userId = userData.user?.id;
  let agentName = 'there';
  if (userId) {
    const { data: agent } = await supabase.from('agents').select('full_name').eq('id', userId).maybeSingle();
    if (agent?.full_name) agentName = (agent.full_name as string).split(' ')[0] ?? agent.full_name;
  }

  type PolicyRow = {
    id: string; client_id: string; policy_type: string; destination: string | null;
    start_date: string; end_date: string; renewal_date: string | null; status: string;
    clients: { full_name: string } | null;
  };
  type ReminderRow = {
    id: string; client_id: string; policy_id: string | null; message_type: string;
    scheduled_at: string; status: string; clients: { full_name: string } | null;
  };
  const policies = (policiesRes.data ?? []) as unknown as PolicyRow[];
  const reminders = (remindersRes.data ?? []) as unknown as ReminderRow[];

  const nameOf = (c: { full_name: string } | null) => c?.full_name ?? 'Unknown client';

  // --- 1. Needs Attention: overdue renewals + failed messages ---
  const needsAttention: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date < today) {
      const d = daysBetween(p.renewal_date, today);
      needsAttention.push({
        id: `overdue-${p.id}`,
        kind: 'overdue_renewal',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `${p.policy_type === 'car' ? 'Car' : 'Home'} policy renewal is overdue`,
        dateLabel: `Renewal was ${fmt(p.renewal_date)}`,
        status: `${d}d overdue`,
        actionLabel: 'Review renewal',
        href: `/policies/${p.id}`,
        tone: 'urgent',
      });
    }
  }
  for (const r of reminders) {
    if (r.status === 'failed') {
      needsAttention.push({
        id: `failed-${r.id}`,
        kind: 'failed_message',
        clientId: r.client_id,
        clientName: nameOf(r.clients),
        reason: 'A scheduled message failed to send',
        dateLabel: `Was due ${fmt(r.scheduled_at.slice(0, 10))}`,
        status: 'Failed',
        actionLabel: 'Investigate',
        href: r.policy_id ? `/policies/${r.policy_id}` : `/clients/${r.client_id}`,
        tone: 'urgent',
      });
    }
  }

  // --- 2. Follow Up Today: renewals within 14 days needing a nudge ---
  const followUp: TodayItem[] = [];
  const in14 = addDays(today, 14);
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date >= today && p.renewal_date <= in14) {
      const d = daysBetween(today, p.renewal_date);
      followUp.push({
        id: `followup-${p.id}`,
        kind: 'renewal_follow_up',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `Renewal is close — reach out to secure it`,
        dateLabel: `Renews ${fmt(p.renewal_date)}`,
        status: relativeStatus(d),
        actionLabel: 'Follow up',
        href: `/policies/${p.id}`,
        tone: 'warning',
      });
    }
  }

  // --- 3. Scheduled Today: reminders with scheduled_at = today, still pending ---
  const scheduledToday: TodayItem[] = [];
  for (const r of reminders) {
    if (r.status === 'pending' && r.scheduled_at.slice(0, 10) === today) {
      scheduledToday.push({
        id: `sched-${r.id}`,
        kind: 'scheduled_today',
        clientId: r.client_id,
        clientName: nameOf(r.clients),
        reason: labelReminder(r.message_type),
        dateLabel: 'Sending today',
        status: 'Pending',
        actionLabel: 'View',
        href: r.policy_id ? `/policies/${r.policy_id}` : `/clients/${r.client_id}`,
        tone: 'info',
      });
    }
  }

  // --- 4. Upcoming Travel: departures within 7 days ---
  const upcomingTravel: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type === 'travel' && p.start_date >= today && p.start_date <= in7) {
      const d = daysBetween(today, p.start_date);
      upcomingTravel.push({
        id: `travel-${p.id}`,
        kind: 'travel_departure',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `Travelling to ${p.destination ?? 'their destination'}`,
        dateLabel: `Departs ${fmt(p.start_date)}`,
        status: relativeStatus(d),
        actionLabel: 'View policy',
        href: `/policies/${p.id}`,
        tone: 'info',
      });
    }
  }

  // --- 5. Upcoming Renewals: within 30 days (excludes the <14 already in follow-up) ---
  const upcomingRenewals: TodayItem[] = [];
  for (const p of policies) {
    if (p.policy_type !== 'travel' && p.renewal_date && p.renewal_date > in14 && p.renewal_date <= in30) {
      const d = daysBetween(today, p.renewal_date);
      upcomingRenewals.push({
        id: `renewal-${p.id}`,
        kind: 'upcoming_renewal',
        clientId: p.client_id,
        clientName: nameOf(p.clients),
        reason: `${p.policy_type === 'car' ? 'Car' : 'Home'} renewal coming up`,
        dateLabel: `Renews ${fmt(p.renewal_date)}`,
        status: relativeStatus(d),
        actionLabel: 'View policy',
        href: `/policies/${p.id}`,
        tone: 'neutral',
      });
    }
  }

  // stats
  const renewalsThisMonth = policies.filter(
    (p) => p.policy_type !== 'travel' && p.renewal_date && p.renewal_date >= today && p.renewal_date < monthEnd,
  ).length;
  const remindersPending = reminders.filter((r) => r.status === 'pending').length;

  const sections: TodaySection[] = [
    { key: 'attention', title: 'Needs attention', emoji: '🔴', items: needsAttention },
    { key: 'followup', title: 'Follow up today', emoji: '🟡', items: followUp },
    { key: 'scheduled', title: 'Scheduled today', emoji: '📤', items: scheduledToday },
    { key: 'travel', title: 'Upcoming travel', emoji: '✈️', items: upcomingTravel },
    { key: 'renewals', title: 'Upcoming renewals', emoji: '📅', items: upcomingRenewals },
  ];

  return {
    agentName,
    stats: {
      clients: clientsRes.count ?? 0,
      activePolicies: policies.length,
      renewalsThisMonth,
      remindersPending,
    },
    summary: {
      urgent: needsAttention.length,
      followUps: followUp.length,
      scheduledToday: scheduledToday.length,
    },
    sections,
  };
}

function labelReminder(t: string): string {
  switch (t) {
    case 'travel_departure': return 'Bon voyage message goes out';
    case 'travel_return': return 'Welcome-home message goes out';
    case 'renewal_60': return 'Renewal reminder (60 days) goes out';
    case 'renewal_30': return 'Renewal reminder (30 days) goes out';
    case 'renewal_7': return 'Renewal reminder (7 days) goes out';
    default: return 'Scheduled message goes out';
  }
}
