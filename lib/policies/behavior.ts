// ============================================================================
// lib/policies/behavior.ts
//
// THE single source of truth for policy classification.
// `PolicyType` is a LABEL (cheap to add); `PolicyBehavior` drives SCHEDULING
// (expensive to add). Adding a future type (e.g. 'disability') is one enum
// value in the DB + one line in POLICY_BEHAVIOR here — nothing else changes.
// ============================================================================

export type PolicyType = 'life' | 'health' | 'ci' | 'car' | 'home' | 'travel';

export type PolicyBehavior =
  | 'protection' // premium-due + anniversary reminders (life, ci)
  | 'renewable' // renewal 60/30/7 reminders (car, home, health)
  | 'event'; // departure/return reminders (travel)

export type PaymentMode = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'single';

/** type -> behavior. THE map. One line per future type. */
export const POLICY_BEHAVIOR: Record<PolicyType, PolicyBehavior> = {
  life: 'protection',
  ci: 'protection',
  health: 'renewable',
  car: 'renewable',
  home: 'renewable',
  travel: 'event',
};

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  life: 'Life',
  health: 'Health',
  ci: 'Critical Illness',
  car: 'Car',
  home: 'Home',
  travel: 'Travel',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Half-yearly',
  annual: 'Annual',
  single: 'Single premium',
};

/** Months between premium due dates; null = no recurring premiums. */
export const PAYMENT_MODE_INTERVAL_MONTHS: Record<PaymentMode, number | null> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
  single: null,
};

export const ALL_POLICY_TYPES: PolicyType[] = ['life', 'health', 'ci', 'car', 'home', 'travel'];

export const behaviorOf = (t: PolicyType): PolicyBehavior => POLICY_BEHAVIOR[t];
export const isProtection = (t: PolicyType) => POLICY_BEHAVIOR[t] === 'protection';
export const isRenewable = (t: PolicyType) => POLICY_BEHAVIOR[t] === 'renewable';
export const isEvent = (t: PolicyType) => POLICY_BEHAVIOR[t] === 'event';
