/**
 * CONTACT IMPORT — parsing layer (dependency-free, source-agnostic).
 *
 * A ParsedContact is the neutral shape every source (CSV, VCF, and future
 * sources like Google/Outlook) maps into. Parsers ONLY extract raw fields; they
 * do no normalization or validation — that happens in the pipeline so it's
 * identical across sources.
 */
export interface ParsedContact {
  full_name: string;
  phone_raw: string;
  email?: string;
}

/** Split a CSV line respecting simple double-quote quoting. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const NAME_KEYS = ['name', 'full name', 'full_name', 'display name', 'contact name', 'first name'];
const PHONE_KEYS = ['phone', 'phone number', 'phone_number', 'mobile', 'mobile number', 'contact', 'number', 'tel', 'telephone'];
const EMAIL_KEYS = ['email', 'email address', 'e-mail'];

function findIndex(headers: string[], keys: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const k of keys) {
    const i = lower.indexOf(k);
    if (i !== -1) return i;
  }
  // partial match fallback (e.g. "Mobile Phone")
  for (let i = 0; i < lower.length; i++) {
    if (keys.some((k) => lower[i]!.includes(k))) return i;
  }
  return -1;
}

/**
 * Parse a CSV string into ParsedContacts. Detects name/phone/email columns by
 * header. If there's a first+last name pair, they're combined. Rows without a
 * usable phone are still returned (with empty phone_raw) so the pipeline can
 * count them as invalid rather than silently dropping them.
 */
export function parseCsv(text: string): ParsedContact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]!);
  const nameIdx = findIndex(headers, NAME_KEYS);
  const firstIdx = findIndex(headers, ['first name', 'first_name', 'given name']);
  const lastIdx = findIndex(headers, ['last name', 'last_name', 'surname', 'family name']);
  const phoneIdx = findIndex(headers, PHONE_KEYS);
  const emailIdx = findIndex(headers, EMAIL_KEYS);

  const contacts: ParsedContact[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx]! : '');

    let name = get(nameIdx);
    if (!name && (firstIdx >= 0 || lastIdx >= 0)) {
      name = `${get(firstIdx)} ${get(lastIdx)}`.trim();
    }
    const phone_raw = get(phoneIdx);
    const email = get(emailIdx);

    // Skip completely empty rows.
    if (!name && !phone_raw && !email) continue;
    contacts.push({ full_name: name || 'Unnamed contact', phone_raw, email: email || undefined });
  }
  return contacts;
}

/**
 * Parse a VCF / vCard string (one or many cards) into ParsedContacts. Handles
 * the common FN, N, TEL, EMAIL fields across vCard 2.1/3.0/4.0. Not a full RFC
 * implementation — deliberately pragmatic for phone-export files.
 */
export function parseVcf(text: string): ParsedContact[] {
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  const contacts: ParsedContact[] = [];

  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    let fn = '';
    let nStructured = '';
    let phone = '';
    let email = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^END:VCARD/i.test(line)) break;
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).toUpperCase();
      const value = line.slice(colon + 1).trim();

      if (key === 'FN' || key.startsWith('FN;')) fn = value;
      else if (key === 'N' || key.startsWith('N;')) {
        // N is "Family;Given;Middle;Prefix;Suffix" — build "Given Family"
        const parts = value.split(';');
        nStructured = `${parts[1] ?? ''} ${parts[0] ?? ''}`.trim();
      } else if (key === 'TEL' || key.startsWith('TEL;')) {
        if (!phone) phone = value; // take the first TEL
      } else if (key === 'EMAIL' || key.startsWith('EMAIL;')) {
        if (!email) email = value;
      }
    }

    const name = fn || nStructured;
    if (!name && !phone && !email) continue;
    contacts.push({ full_name: name || 'Unnamed contact', phone_raw: phone, email: email || undefined });
  }
  return contacts;
}

/** Dispatch by file extension / content. */
export function parseContacts(filename: string, text: string): ParsedContact[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.vcf') || /BEGIN:VCARD/i.test(text)) return parseVcf(text);
  return parseCsv(text);
}
