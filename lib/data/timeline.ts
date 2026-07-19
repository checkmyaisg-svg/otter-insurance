import { formatDate } from '@/lib/format/display';
import { createClient } from '@/lib/supabase/server';
import type { PolicyListItem } from '@/lib/data/policies';

/**
 * TIMELINE EVENT MODEL
 *
 * The client timeline is the growing history of a customer's journey. To let it
 * grow WITHOUT rewrites, every event is a single discriminated shape keyed by
 * `kind`. V1 derives events from existing data (policies + scheduled_messages).
 * Future kinds (whatsapp_sent, customer_replied, ai_classification, payment_
 * confirmed, …) just add a new `kind` value + a renderer branch — no schema or
 * model change. The list below documents the intended vocabulary; only the V1
 * kinds are produced today.
 */
export type TimelineEventKind =
  // --- V1 (produced now) ---
  | 'policy_created'
  | 'reminder_scheduled'
  // --- Future (reserved; NOT produced yet) ---
  | 'whatsapp_sent'
  | 'whatsapp_delivered'
  | 'customer_replied'
  | 'ai_classification'
  | 'ai_suggested_reply'
  | 'manual_reply_sent'
  | 'payment_confirmed'
  | 'renewal_completed'
  | 'task_completed';

/** Visual tone for an event, so the renderer can color it consistently. */
export type TimelineTone = 'neutral' | 'primary' | 'success' | 'warning' | 'muted';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** When this event occurred or is scheduled to occur (ISO). Sorts the timeline. */
  at: string;
  /** Whether `at` is in the future (scheduled) vs past (happened). */
  scheduled: boolean;
  title: string;
  detail?: string;
  tone: TimelineTone;
}

const REMINDER_LABEL: Record<string, string> = {
  travel_departure: 'Bon voyage message',
  travel_return: 'Welcome-home message',
  renewal_60: 'Renewal reminder (60 days)',
  renewal_30: 'Renewal reminder (30 days)',
  renewal_7: 'Renewal reminder (7 days)',
  premium_due: 'Premium due reminder',
  anniversary: 'Policy anniversary',
  manual: 'Manual message',
};

const STATUS_TONE: Record<string, TimelineTone> = {
  pending: 'primary',
  processing: 'primary',
  sent: 'success',
  failed: 'warning',
  cancelled: 'muted',
};

/**
 * Build the V1 timeline for a client from their policies + scheduled reminders.
 * Reads only (RLS-scoped). Returns events sorted newest/soonest first, with a
 * split the UI can use: past events above "now", upcoming below — but we return
 * one merged, sorted list and let the component group if it wants.
 */
export async function getClientTimeline(
  clientId: string,
  policies: PolicyListItem[],
): Promise<TimelineEvent[]> {
  const supabase = await createClient();

  const { data: reminders, error } = await supabase
    .from('scheduled_messages')
    .select('id, policy_id, message_type, scheduled_at, status, created_at, template_name')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true });
  if (error) throw new Error(error.message);

  const now = Date.now();
  const events: TimelineEvent[] = [];

  // policy_created events
  for (const p of policies) {
    const TYPE_LABEL: Record<string, string> = {
      travel: 'Travel', car: 'Car', home: 'Home', life: 'Life', health: 'Health', ci: 'Critical Illness',
    };
    const label =
      p.policy_type === 'travel'
        ? `Travel policy created${p.destination ? ` — ${p.destination}` : ''}`
        : `${TYPE_LABEL[p.policy_type] ?? p.policy_type} policy created`;
    events.push({
      id: `policy-${p.id}`,
      kind: 'policy_created',
      at: p.created_at,
      scheduled: false,
      title: label,
      detail:
        p.policy_type === 'travel'
          ? `Departs ${formatDate(p.start_date)}, returns ${formatDate(p.end_date)}`
          : p.renewal_date
            ? `Renews ${formatDate(p.renewal_date)}`
            : `Since ${formatDate(p.start_date)}`,
      tone: 'neutral',
    });
  }

  // reminder_scheduled events
  for (const r of reminders ?? []) {
    const at = r.scheduled_at as string;
    const status = r.status as string;
    events.push({
      id: `reminder-${r.id as string}`,
      kind: 'reminder_scheduled',
      at,
      scheduled: new Date(at).getTime() > now && status === 'pending',
      title:
        r.message_type === 'manual' && (r.template_name as string | null)?.startsWith('wa_draft')
          ? 'WhatsApp message'
          : REMINDER_LABEL[r.message_type as string] ?? (r.message_type as string),
      detail:
        r.message_type === 'manual' && (r.template_name as string | null)?.startsWith('wa_draft')
          ? 'Opened in WhatsApp by you'
          : `Status: ${status}`,
      tone: STATUS_TONE[status] ?? 'neutral',
    });
  }

  // Sort: soonest-upcoming and most-recent-past interleave by time, newest first.
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}
