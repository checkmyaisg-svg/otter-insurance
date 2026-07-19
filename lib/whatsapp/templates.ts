// ============================================================================
// lib/whatsapp/templates.ts
//
// Deterministic WhatsApp message templates — V1 (Tuesday production).
// PURE functions: same input, same message, every time. No AI, no I/O.
// Written for a Singapore advisor's voice: warm, brief, no hard sell.
//
// UPGRADE SEAM (V0.3, WhatsApp Cloud API): these template ids map 1:1 onto
// future Meta-approved templates. The reminder engine already stamps
// template_name on every scheduled row; the send job will render the same
// context through approved templates. Nothing in the scheduler changes.
// ============================================================================

export type DraftKind =
  | 'renewal' // renewal_60 / renewal_30 / renewal_7 / follow-ups / overdue
  | 'premium_due'
  | 'anniversary'
  | 'travel_departure'
  | 'travel_return'
  | 'birthday';

export interface DraftContext {
  /** Client's first name, e.g. "Mei Ling" -> "Mei Ling" (we use the given name as stored, first token). */
  clientFirstName: string;
  /** Human policy label, e.g. "Car", "Life". */
  policyLabel: string;
  /** Preformatted date text, e.g. "12 Aug 2026". Empty string if unknown. */
  dateText: string;
  /** Travel destination, when relevant. */
  destination?: string | null;
  /** Insurer name, when known (adds specificity). */
  insurer?: string | null;
  /** Whether the renewal date is already past (changes phrasing honestly). */
  overdue?: boolean;
}

/** First token of a full name; falls back to the whole string. */
export function firstNameOf(fullName: string): string {
  const t = fullName.trim().split(/\s+/)[0];
  return t && t.length > 0 ? t : fullName.trim();
}

const withInsurer = (label: string, insurer?: string | null) =>
  insurer && insurer.trim() ? `${insurer.trim()} ${label.toLowerCase()}` : label.toLowerCase();

/**
 * Build the deterministic message body for a draft kind + context.
 * Every branch is exercised by unit tests; wording changes are versioned here.
 */
export function buildDraftMessage(kind: DraftKind, ctx: DraftContext): string {
  const name = ctx.clientFirstName.trim() || 'there';

  switch (kind) {
    case 'renewal': {
      const policy = withInsurer(`${ctx.policyLabel} policy`, ctx.insurer);
      if (ctx.overdue) {
        return (
          `Hi ${name}, this is a gentle reminder that your ${policy} renewal date` +
          `${ctx.dateText ? ` (${ctx.dateText})` : ''} has passed. ` +
          `Shall I help you sort out the renewal this week? Happy to give you a quick call.`
        );
      }
      return (
        `Hi ${name}! Just a heads-up — your ${policy} is due for renewal` +
        `${ctx.dateText ? ` on ${ctx.dateText}` : ' soon'}. ` +
        `Would you like me to run through the options before then? Happy to help.`
      );
    }

    case 'premium_due': {
      const policy = withInsurer(`${ctx.policyLabel} policy`, ctx.insurer);
      return (
        `Hi ${name}! A friendly reminder that the premium for your ${policy} is due` +
        `${ctx.dateText ? ` on ${ctx.dateText}` : ' soon'}. ` +
        `No action needed if it's on GIRO — just let me know if anything has changed. 🙂`
      );
    }

    case 'anniversary': {
      const policy = withInsurer(`${ctx.policyLabel} policy`, ctx.insurer);
      return (
        `Hi ${name}! It's been another year since you started your ${policy}` +
        `${ctx.dateText ? ` (${ctx.dateText})` : ''} — thank you for your continued trust. ` +
        `If you'd like, we can do a quick review to make sure your coverage still fits. 😊`
      );
    }

    case 'travel_departure': {
      const dest = ctx.destination?.trim();
      return (
        `Hi ${name}! ${dest ? `All set for ${dest}? ` : 'All set for your trip? '}` +
        `Your travel cover is active${ctx.dateText ? ` from ${ctx.dateText}` : ''}. ` +
        `Have a wonderful trip — I'm just a message away if anything comes up. ✈️`
      );
    }

    case 'birthday': {
      // Birthday greeting. Deliberately does NOT pitch a product — the greeting
      // IS the touchpoint; the review conversation follows naturally in chat.
      return (
        `Happy birthday, ${ctx.clientFirstName}! 🎂 ` +
        `Wishing you a wonderful year ahead. ` +
        `If you'd like, we can do a quick review of your coverage sometime this month — ` +
        `a birthday is a good checkpoint to make sure everything still fits. Enjoy your day!`
      );
    }
    case 'travel_return': {
      return (
        `Hi ${name}, welcome back! Hope the trip was great. ` +
        `If anything happened along the way that we should look at (claims, lost items, delays), ` +
        `just let me know and I'll handle it for you.`
      );
    }
  }
}

/**
 * Map a scheduled_messages.message_type to a DraftKind (renewal_60/30/7 all
 * collapse to 'renewal'). Returns null for types with no client-facing draft
 * (e.g. 'manual' log rows).
 */
export function draftKindForMessageType(messageType: string): DraftKind | null {
  switch (messageType) {
    case 'renewal_60':
    case 'renewal_30':
    case 'renewal_7':
      return 'renewal';
    case 'premium_due':
      return 'premium_due';
    case 'anniversary':
      return 'anniversary';
    case 'travel_departure':
      return 'travel_departure';
    case 'travel_return':
      return 'travel_return';
    default:
      return null;
  }
}
