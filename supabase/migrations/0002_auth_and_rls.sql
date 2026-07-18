-- ============================================================================
-- Migration 0002: Authentication wiring + Row Level Security
--
-- WHY THIS EXISTS
-- Migration 0001 enabled RLS on every table but defined NO policies, which is a
-- deny-all posture. This migration:
--   1. Auto-provisions an `agents` row when a user signs up (auth.users insert).
--   2. Defines the per-tenant RLS policies so an authenticated agent can only
--      touch rows where agent_id = their own auth.uid().
--   3. Grants the base table privileges the `authenticated` role needs (RLS
--      then filters WHICH rows within those privileges).
--
-- TENANCY MODEL
--   agents.id === auth.users.id  (the agent IS the auth user in V1)
--   every other table.agent_id  -> agents.id
--   therefore the universal predicate is: agent_id = auth.uid()
--   and for agents itself:              id = auth.uid()
--
-- SERVICE ROLE
--   The send job and WhatsApp webhook connect with the service-role key, which
--   BYPASSES RLS entirely. They are server-only and must filter by agent_id in
--   their own SQL. No policy here applies to them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUTO-PROVISION AGENT ON SIGNUP
--
-- Runs as SECURITY DEFINER (owner = postgres) so it can insert into `agents`
-- despite RLS. search_path is pinned to prevent search-path hijacking, a
-- standard hardening step for SECURITY DEFINER functions. full_name falls back
-- to the local-part of the email if the client didn't pass user metadata.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (id, full_name, phone_number)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'phone_number', '')
  )
  on conflict (id) do nothing;  -- idempotent: never error if the row exists
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. BASE TABLE PRIVILEGES for the `authenticated` role.
-- RLS narrows these to the agent's own rows. `anon` gets nothing (no session,
-- no data). job_runs is intentionally omitted — see section 4.
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, update                          on public.agents             to authenticated;
grant select, insert, update, delete          on public.clients            to authenticated;
grant select, insert, update, delete          on public.policies           to authenticated;
grant select, insert, update, delete          on public.scheduled_messages to authenticated;
grant select                                  on public.message_logs       to authenticated;
-- (no grants on job_runs)

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES
-- ----------------------------------------------------------------------------

-- AGENTS ---------------------------------------------------------------------
-- An agent may read and update ONLY their own profile row. No INSERT policy:
-- creation happens exclusively via the SECURITY DEFINER signup trigger above,
-- so an authenticated user can never fabricate an agents row for someone else.
-- No DELETE policy: account deletion cascades from auth.users, not app code.
create policy agents_select_own on public.agents
  for select to authenticated
  using (id = auth.uid());

create policy agents_update_own on public.agents
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- CLIENTS --------------------------------------------------------------------
-- Full CRUD, but every row is fenced to the owning agent. The WITH CHECK on
-- insert/update blocks an agent from writing a row stamped with someone else's
-- agent_id (tenant-spoofing defense).
create policy clients_select_own on public.clients
  for select to authenticated
  using (agent_id = auth.uid());

create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (agent_id = auth.uid());

create policy clients_update_own on public.clients
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy clients_delete_own on public.clients
  for delete to authenticated
  using (agent_id = auth.uid());

-- POLICIES -------------------------------------------------------------------
create policy policies_select_own on public.policies
  for select to authenticated
  using (agent_id = auth.uid());

create policy policies_insert_own on public.policies
  for insert to authenticated
  with check (agent_id = auth.uid());

create policy policies_update_own on public.policies
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy policies_delete_own on public.policies
  for delete to authenticated
  using (agent_id = auth.uid());

-- SCHEDULED_MESSAGES ---------------------------------------------------------
-- Agents create/update/cancel their own reminders through server actions that
-- run in the user's session (scheduler reconcile). The send job mutates these
-- via the service role, bypassing RLS. Both paths are safe: user-session writes
-- are fenced by agent_id; service-role writes are server-only.
create policy scheduled_messages_select_own on public.scheduled_messages
  for select to authenticated
  using (agent_id = auth.uid());

create policy scheduled_messages_insert_own on public.scheduled_messages
  for insert to authenticated
  with check (agent_id = auth.uid());

create policy scheduled_messages_update_own on public.scheduled_messages
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy scheduled_messages_delete_own on public.scheduled_messages
  for delete to authenticated
  using (agent_id = auth.uid());

-- MESSAGE_LOGS ---------------------------------------------------------------
-- READ-ONLY for agents (they view their own message history on the client
-- profile). ALL writes happen in server-only code via the service role: the
-- send job logs outbound sends, the webhook logs delivery updates and inbound
-- messages, and manual-send logging also runs server-side. Giving authenticated
-- users no INSERT/UPDATE/DELETE keeps the audit trail tamper-resistant.
create policy message_logs_select_own on public.message_logs
  for select to authenticated
  using (agent_id = auth.uid());

-- JOB_RUNS -------------------------------------------------------------------
-- DELIBERATELY has NO policies and NO grants for authenticated users.
-- Rationale: a single send-job execution spans EVERY tenant's messages, so a
-- job_runs row has no agent_id and cannot be tenant-scoped. Exposing it to an
-- agent would leak cross-tenant operational data (global counts, timing).
-- job_runs is written and read ONLY by the service role in server-only code.
-- The per-agent Health Dashboard derives "failed messages" and "pending
-- retries" from scheduled_messages (which IS tenant-scoped above); the global
-- "last run / success rate" view is an operator concern served server-side.
-- With RLS enabled and no policy, authenticated access is denied by default.
-- (No statements needed here — this comment documents the intentional absence.)
