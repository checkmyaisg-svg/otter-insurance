/**
 * PORTFOLIO INTELLIGENCE — pure revenue & quiet-client math. Zero imports,
 * fully tested. Every figure derives from recorded premiums; nothing invented.
 */

export type PaymentModeKey = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'single';

const PERIODS_PER_YEAR: Record<PaymentModeKey, number> = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single: 0, // one-off: excluded from recurring book value
};

/** Annualized recurring premium for a policy; 0 when unknowable. */
export function annualizedPremium(mode: string | null, amount: number | null): number {
  if (amount == null || amount <= 0 || !mode) return 0;
  const k = PERIODS_PER_YEAR[mode as PaymentModeKey];
  return k ? amount * k : 0;
}

export type QuietClass = 'never' | 'quiet' | 'ok' | 'new';

/**
 * Classify contact recency. Brand-new clients (< graceDays old) are never
 * flagged — silence is expected during onboarding.
 */
export function classifyQuiet(
  lastContact: string | null,
  clientSince: string,
  today: string,
  quietDays = 90,
  graceDays = 30,
): QuietClass {
  const DAY = 86400000;
  const age = Math.round((Date.parse(today) - Date.parse(clientSince)) / DAY);
  if (age < graceDays) return 'new';
  if (lastContact === null) return 'never';
  const gap = Math.round((Date.parse(today) - Date.parse(lastContact)) / DAY);
  return gap >= quietDays ? 'quiet' : 'ok';
}
