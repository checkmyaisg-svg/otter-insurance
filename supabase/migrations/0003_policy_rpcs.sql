-- ============================================================================
-- Migration 0003: Policy transaction RPCs + role-authz documentation
--
-- WHY THIS EXISTS
-- The Supabase JS client auto-commits each .from() call, so a policy write plus
-- its reminder inserts/updates/cancels cannot be made atomic from the client.
-- These SECURITY INVOKER functions run the whole reconcile as ONE statement =
-- ONE transaction: if any step fails, everything rolls back. SECURITY INVOKER
-- means RLS still applies as the calling agent, and auth.uid() resolves to them.
--
-- DIVISION OF LABOUR
--   TypeScript owns the business logic: scheduleForPolicy() + reconcileReminders()
--   compute WHICH reminders to insert/update/cancel (fully unit-tested).
--   SQL owns atomicity + optimistic locking + tenant stamping: these functions
--   just persist the pre-computed diff transactionally and safely.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- IMPROVEMENT #1: Role-based authorization — DOCUMENTED, NOT IMPLEMENTED.
-- Attaching the intent to the table itself (visible via \d+ and catalogs) so a
-- future migration can add it without hunting through code.
--
-- Planned future roles (do NOT implement yet):
--   * agent     — the account owner (today every user is implicitly this)
--   * assistant — delegated staff with limited write access under an agent
--   * admin     — operator/support with cross-tenant visibility
--
-- Future path (additive, no refactor): add a `role` column to agents (or a
-- separate `agent_members` table for multi-user-per-tenant), then extend the
-- RLS predicates from "agent_id = auth.uid()" to a helper like
-- "agent_id = current_agent_id()" that resolves the tenant for the acting user.
-- The `created_by` TODOs already seeded on clients/policies/scheduled_messages
-- pair with this to record which member performed each write.
-- ----------------------------------------------------------------------------

comment on table public.agents is
  'Tenant root (agents.id = auth.users.id). TODO future role-based authz: '
  'roles agent|assistant|admin; add a role column or agent_members table and '
  'switch RLS from agent_id = auth.uid() to a tenant-resolver helper. Not yet implemented.';

-- ----------------------------------------------------------------------------
-- create_policy_with_reminders
-- Inserts a policy and its initial reminders atomically. The policy id is
-- generated client-side (so the scheduler can build idempotency keys before the
-- write); agent_id is stamped here from auth.uid() so the client cannot spoof
-- tenancy. Client ownership is verified through an RLS-filtered SELECT.
-- ----------------------------------------------------------------------------

create or replace function public.create_policy_with_reminders(
  p_policy    jsonb,   -- { id, client_id, policy_type, destination, start_date, end_date, renewal_date, status }
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

  -- Ownership check: under RLS the caller only sees their own clients, so a
  -- foreign client_id yields no row here even though the FK would accept it.
  perform 1 from public.clients where id = v_client;
  if not found then
    raise exception 'client_not_found' using errcode = 'PT404';
  end if;

  insert into public.policies (
    id, agent_id, client_id, policy_type, destination,
    start_date, end_date, renewal_date, status
  )
  values (
    v_policy_id, v_agent, v_client,
    (p_policy ->> 'policy_type')::policy_type_enum,
    nullif(p_policy ->> 'destination', ''),
    (p_policy ->> 'start_date')::date,
    (p_policy ->> 'end_date')::date,
    (p_policy ->> 'renewal_date')::date,
    coalesce((p_policy ->> 'status')::policy_status_enum, 'active')
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

-- ----------------------------------------------------------------------------
-- update_policy_with_reminders
-- Optimistic-locked policy update + reminder reconcile, atomic.
-- Raises 'version_conflict' (SQLSTATE PT409) if p_expected_version is stale, or
-- 'policy_not_found' (PT404) if the policy doesn't exist or isn't the caller's.
-- Updates only touch pending/cancelled reminder rows; the TypeScript reconcile
-- already excluded sent/processing/failed rows from the diff.
-- ----------------------------------------------------------------------------

create or replace function public.update_policy_with_reminders(
  p_policy_id       uuid,
  p_expected_version integer,
  p_policy          jsonb,   -- same shape as create (id ignored)
  p_inserts         jsonb,   -- [ { messageType, scheduledAt, templateName, idempotencyKey } ]
  p_updates         jsonb,   -- [ { id, scheduledAt, idempotencyKey } ]
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
    version      = version + 1
  where id = p_policy_id
    and version = p_expected_version
  returning version, client_id into v_new_version, v_client;

  if not found then
    -- Disambiguate: an RLS-visible row means it's ours but the version was
    -- stale (conflict); no visible row means not found / not owned.
    if exists (select 1 from public.policies where id = p_policy_id) then
      raise exception 'version_conflict' using errcode = 'PT409';
    else
      raise exception 'policy_not_found' using errcode = 'PT404';
    end if;
  end if;

  -- Inserts (new reminders the edit introduced)
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

  -- Updates (time shifted, or reviving a cancelled row). Reset retry state so a
  -- rescheduled reminder starts clean. Guard on status so we never resurrect a
  -- sent/processing/failed row even if a stale diff slipped through.
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

  -- Cancels (reminders no longer applicable). Only pending rows.
  if p_cancel_ids is not null and array_length(p_cancel_ids, 1) is not null then
    update public.scheduled_messages set status = 'cancelled'
    where id = any(p_cancel_ids)
      and status = 'pending';
  end if;

  return v_new_version;
end;
$$;
