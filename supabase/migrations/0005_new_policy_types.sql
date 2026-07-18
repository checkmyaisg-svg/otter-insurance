-- ============================================================================
-- 0005 — V0.2 enum additions (run FIRST, as its own execution).
-- Postgres cannot USE a new enum value in the same transaction that adds it,
-- so these live alone; 0006 (which references them) runs separately after.
-- Purely additive: no existing rows or code paths are affected.
-- ============================================================================

-- New policy classifications (behavior mapping lives in the app layer).
alter type policy_type_enum add value if not exists 'life';
alter type policy_type_enum add value if not exists 'health';
alter type policy_type_enum add value if not exists 'ci';

-- New message types for the Protection scheduling behavior.
alter type message_type_enum add value if not exists 'premium_due';
alter type message_type_enum add value if not exists 'anniversary';

-- Payment cadence for premium-due scheduling.
do $$ begin
  create type payment_mode_enum as enum
    ('monthly', 'quarterly', 'semi_annual', 'annual', 'single');
exception when duplicate_object then null;
end $$;
