/**
 * Normalizes a Singapore phone number to E.164 (+65XXXXXXXX).
 * Accepts local 8-digit numbers, numbers with spaces/dashes, a leading 65, or
 * an existing +65. Throws on anything that isn't a plausible SG mobile/landline.
 * Kept deliberately strict for V1 (single market); broaden when expanding.
 */
export function normalizeSgPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[\s()-]/g, '').replace(/^\+/, '');

  let local: string;
  if (digits.startsWith('65') && digits.length === 10) {
    local = digits.slice(2);
  } else if (digits.length === 8) {
    local = digits;
  } else {
    throw new Error('Enter a valid Singapore phone number (8 digits).');
  }

  if (!/^[3689]\d{7}$/.test(local)) {
    throw new Error('Enter a valid Singapore phone number.');
  }
  return `+65${local}`;
}
