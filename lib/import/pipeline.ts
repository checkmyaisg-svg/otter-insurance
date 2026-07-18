import { normalizeSgPhone } from '@/lib/format/phone';
import type { ParsedContact } from './parse';

/**
 * CONTACT IMPORT — normalization + categorization pipeline (pure).
 *
 * Takes raw ParsedContacts plus the set of phone numbers already in the tenant,
 * and sorts each contact into exactly one bucket:
 *   - valid:      normalizes cleanly, not a duplicate — importable
 *   - duplicate:  normalizes, but the number already exists (in DB or the file)
 *   - invalid:    no phone / fails SG normalization
 * The buckets drive both the preview UI and the summary counts. Source-agnostic.
 */

export type ImportCategory = 'valid' | 'duplicate' | 'invalid';

export interface ReviewContact {
  /** stable index for selection */
  key: string;
  full_name: string;
  /** normalized E.164 when valid/duplicate; original raw when invalid */
  phone: string;
  phone_raw: string;
  email?: string;
  category: ImportCategory;
  reason?: string; // for invalid: why
}

export interface CategorizedImport {
  contacts: ReviewContact[];
  counts: { total: number; valid: number; duplicate: number; invalid: number };
}

/**
 * Categorize parsed contacts against existing tenant phone numbers.
 * @param parsed        contacts extracted from the file
 * @param existingPhones E.164 numbers already in the tenant (for dedup)
 */
export function categorizeContacts(
  parsed: ParsedContact[],
  existingPhones: Set<string>,
): CategorizedImport {
  const seenInFile = new Set<string>();
  const contacts: ReviewContact[] = [];
  let valid = 0;
  let duplicate = 0;
  let invalid = 0;

  parsed.forEach((c, i) => {
    const key = `row-${i}`;
    let normalized: string | null = null;
    try {
      normalized = normalizeSgPhone(c.phone_raw ?? '');
    } catch {
      normalized = null;
    }

    if (!normalized) {
      invalid++;
      contacts.push({
        key,
        full_name: c.full_name,
        phone: c.phone_raw ?? '',
        phone_raw: c.phone_raw ?? '',
        email: c.email,
        category: 'invalid',
        reason: c.phone_raw ? 'Not a valid Singapore number' : 'No phone number',
      });
      return;
    }

    const isDup = existingPhones.has(normalized) || seenInFile.has(normalized);
    if (isDup) {
      duplicate++;
      contacts.push({
        key,
        full_name: c.full_name,
        phone: normalized,
        phone_raw: c.phone_raw,
        email: c.email,
        category: 'duplicate',
        reason: existingPhones.has(normalized) ? 'Already in your clients' : 'Duplicate in file',
      });
      return;
    }

    seenInFile.add(normalized);
    valid++;
    contacts.push({
      key,
      full_name: c.full_name,
      phone: normalized,
      phone_raw: c.phone_raw,
      email: c.email,
      category: 'valid',
    });
  });

  return {
    contacts,
    counts: { total: parsed.length, valid, duplicate, invalid },
  };
}
