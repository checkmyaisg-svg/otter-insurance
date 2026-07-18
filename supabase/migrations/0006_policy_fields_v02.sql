-- ============================================================================
-- 0006 — V0.2 policy fields, behavior-aware constraints, index fix, RPC update.
-- Run AFTER 0005. Backward compatible:
--   * all new columns nullable or defaulted (existing rows untouched)
--   * end_date NOT NULL -> nullable (widening; new CHECK still requires it
--     where it's meaningful)
--   * constraint swap is satisfied by all existing rows by construction
--   * RPCs replaced additively (missing jsonb keys read as NULL)
-- ============================================================================

-- ---- 1. New columns ----
alter table policies
  add column if not exists insurer            text,
  add column if not exists policy_number      text,
  add column if not exists premium_amount     numeric(12,2),
  add column if not exists payment_mode       payment_mode_enum,
  add column if not exists sum_assured        numeric(14,2),
  add column if not exists riders             jsonb not null default '[]'::jsonb,
  -- Reserved for future use (no UI in V0.2):
  add column if not exists policy_holder_name text,
  add column if not exists insured_name       text;

comment on column policies.riders is
  'Display-only in V0.2: array of {name, sum_assured?} objects.';
comment on column policies.policy_holder_name is 'Reserved — future policy holder support.';
comment on column policies.insured_name is 'Reserved — future insured-person support.';

-- ---- 2. end_date becomes optional (whole-life has no end date) ----
alter table policies alter column end_date drop not null;

-- chk_dates_ordered referenced end_date assuming NOT NULL; make it null-safe.
alter table policies drop constraint if exists chk_dates_ordered;
alter table policies add constraint chk_dates_ordered
  check (end_date is null or end_date >= start_date);

-- ---- 3. Behavior-aware shape constraint ----
-- travel (event):            renewal null, end_date required
-- car/home/health (renewable): renewal required, end_date required
-- life/ci (protection):      renewal null (anniversaries derive from start_date)
alter table policies drop constraint if exists chk_renewal_by_type;
alter table policies add constraint chk_renewal_by_type
  check (
    (policy_type = 'travel'
       and renewal_date is null and end_date is not null)
    or (policy_type in ('car', 'home', 'health')
       and renewal_date is not null and end_date is not null)
    or (policy_type in ('life', 'ci')
       and renewal_date is null)
  );

-- Destination stays travel-only (unchanged semantics, re-stated for clarity).
alter table policies drop constraint if exists chk_destination_travel_only;
alter table policies add constraint chk_destination_travel_only
  check (policy_type = 'travel' or destination is null);

-- ---- 4. Unique index fix for repeating reminders ----
-- Old: one row per (policy_id, message_type) — correct when each type occurred
-- once per policy. Monthly premium_due breaks that. New: date-aware uniqueness.
-- The idempotency_key unique index (policy+type+date, deterministic) remains
-- the hard duplicate guard.
drop index if exists uq_scheduled_policy_type;
create unique index uq_scheduled_policy_type
  on scheduled_messages (policy_id, message_type, scheduled_at)
  where message_type <> 'manual';

-- ---- 5. RPCs learn the new fields ----
-- IMPORTANT: these are the ORIGINAL 0003 bodies with only additive changes
-- (new columns in the insert/update lists). Signatures are unchanged so the
-- running app keeps calling them identically; missing jsonb keys read as NULL.

create or replace function public.create_policy_with_reminders(
  p_policy    jsonb,   -- { id, client_id, policy_type, destination, start_date, end_date, renewal_date, status, insurer, policy_number, premium_amount, payment_mode, sum_assured, riders }
  p_reminders jsonb    -- [ { messageType, scheduledAt, templateName, idempotencyKey }, ... ]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agent     uuid := auth.uid();
  v_client    uuid := (p_policy ->> 'client_id')::uuid;
  v_policy_id uuid := (p_policy ->> 'id')::uuid;
  r           jsonb;
begin
  if v_agent is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- Ownership check: under RLS the caller only sees their own clients.
  perform 1 from public.clients where id = v_client;
  if not found then
    raise exception 'client_not_found' using errcode = 'PT404';
  end if;

  insert into public.policies (
    id, agent_id, client_id, policy_type, destination,
    start_date, end_date, renewal_date, status,
    insurer, policy_number, premium_amount, payment_mode, sum_assured, riders
  )
  values (
    v_policy_id, v_agent, v_client,
    (p_policy ->> 'policy_type')::policy_type_enum,
    nullif(p_policy ->> 'destination', ''),
    (p_policy ->> 'start_date')::date,
    (p_policy ->> 'end_date')::date,
    (p_policy ->> 'renewal_date')::date,
    coalesce((p_policy ->> 'status')::policy_status_enum, 'active'),
    nullif(p_policy ->> 'insurer', ''),
    nullif(p_policy ->> 'policy_number', ''),
    (nullif(p_policy ->> 'premium_amount', ''))::numeric,
    (nullif(p_policy ->> 'payment_mode', ''))::payment_mode_enum,
    (nullif(p_policy ->> 'sum_assured', ''))::numeric,
    coalesce(p_policy -> 'riders', '[]'::jsonb)
  );

  for r in select * from jsonb_array_elements(coalesce(p_reminders, '[]'::jsonb))
  loop
    insert into public.scheduled_messages (
      agent_id, client_id, policy_id, message_type,
      template_name, scheduled_at, idempotency_key, status
    )
    values (
      v_agent, v_client, v_policy_id,
      (r ->> 'messageType')::message_type_enum,
      r ->> 'templateName',
      (r ->> 'scheduledAt')::timestamptz,
      r ->> 'idempotencyKey',
      'pending'
    );
  end loop;

  return v_policy_id;
end;
$$;

create or replace function public.update_policy_with_reminders(
  p_policy_id       uuid,
  p_expected_version integer,
  p_policy          jsonb,
  p_inserts         jsonb,
  p_updates         jsonb,
  p_cancel_ids      uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agent       uuid := auth.uid();
  v_client      uuid;
  v_new_version integer;
  r             jsonb;
  u             jsonb;
begin
  if v_agent is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  update public.policies set
    policy_type  = (p_policy ->> 'policy_type')::policy_type_enum,
    destination  = nullif(p_policy ->> 'destination', ''),
    start_date   = (p_policy ->> 'start_date')::date,
    end_date     = (p_policy ->> 'end_date')::date,
    renewal_date = (p_policy ->> 'renewal_date')::date,
    status       = (p_policy ->> 'status')::policy_status_enum,
    insurer         = nullif(p_policy ->> 'insurer', ''),
    policy_number   = nullif(p_policy ->> 'policy_number', ''),
    premium_amount  = (nullif(p_policy ->> 'premium_amount', ''))::numeric,
    payment_mode    = (nullif(p_policy ->> 'payment_mode', ''))::payment_mode_enum,
    sum_assured     = (nullif(p_policy ->> 'sum_assured', ''))::numeric,
    riders          = coalesce(p_policy -> 'riders', riders),
    version      = version + 1
  where id = p_policy_id
    and version = p_expected_version
  returning version, client_id into v_new_version, v_client;

  if not found then
    if exists (select 1 from public.policies where id = p_policy_id) then
      raise exception 'version_conflict' using errcode = 'PT409';
    else
      raise exception 'policy_not_found' using errcode = 'PT404';
    end if;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb))
  loop
    insert into public.scheduled_messages (
      agent_id, client_id, policy_id, message_type,
      template_name, scheduled_at, idempotency_key, status
    )
    values (
      v_agent, v_client, p_policy_id,
      (r ->> 'messageType')::message_type_enum,
      r ->> 'templateName',
      (r ->> 'scheduledAt')::timestamptz,
      r ->> 'idempotencyKey',
      'pending'
    );
  end loop;

  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    update public.scheduled_messages set
      scheduled_at    = (u ->> 'scheduledAt')::timestamptz,
      idempotency_key = u ->> 'idempotencyKey',
      status          = 'pending',
      attempts        = 0,
      next_retry_at   = null,
      last_error      = null,
      error_code      = null
    where id = (u ->> 'id')::uuid
      and status in ('pending', 'cancelled');
  end loop;

  if p_cancel_ids is not null and array_length(p_cancel_ids, 1) is not null then
    update public.scheduled_messages set status = 'cancelled'
    where id = any(p_cancel_ids)
      and status = 'pending';
  end if;

  return v_new_version;
end;
$$;
