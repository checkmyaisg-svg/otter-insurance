// ============================================================================
// lib/whatsapp/link.ts
//
// Click-to-chat link construction. wa.me expects the phone in international
// format with NO '+', spaces, or dashes — digits only. Clients store phones in
// E.164 (e.g. "+6591234567") via normalizeSgPhone, so this is a strip+validate.
// Pure and unit-tested; used by both server (dashboard) and client (button).
// ============================================================================

/**
 * Convert an E.164-ish phone to wa.me digits. Returns null when the number
 * can't produce a valid link (missing, too short/long, non-numeric garbage) —
 * callers render a helpful "no phone" state instead of a broken link.
 */
export function waPhoneFromE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // ITU E.164: max 15 digits; sensible minimum 8 (SG local is 8 + country 2).
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Build the click-to-chat URL. Message is fully URL-encoded (emoji-safe). */
export function buildWaUrl(waPhone: string, message: string): string {
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}
