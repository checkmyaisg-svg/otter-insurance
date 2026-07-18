-- ============================================================================
-- Migration 0001: Initial Schema
-- Insurance Client Automation System — V1
--
-- WHY THIS EXISTS
-- Foundation schema for a multi-tenant reminder automation platform.
-- Every business table carries agent_id (tenant key). Status/type fields are
-- Postgres enums (never free text). RLS is ENABLED on all tables here as a
-- deny-by-default posture; the actual per-tenant policies land in Milestone 4
-- (Auth & RLS). The server-side send job uses the service role key, which
-- bypasses RLS, so background automation is unaffected by the lockdown.
--
-- KEY ASSUMPTIONS (flagged for review — see milestone notes)
-- 1. Manual sends are scheduled_messages rows with message_type='manual' and a
--    nullable policy_id; the duplicate-prevention unique index is PARTIAL and
--    excludes 'manual'.
-- 2. Clients are soft-deleted (deleted_at). Hard deletes cascade in the FK
--    graph anyway, as a safety net.
-- 3. Phone numbers are stored in E.164 (+6591234567). Normalization happens
--    in the app layer (zod), not the database.
-- 4. Optimistic locking uses an integer `version` column on clients and
--    policies. Server actions must include `WHERE version = $expected` and
--    increment it; zero rows updated => conflict => friendly refresh message.
-- 5. scheduled_messages.template_name records the EXACT Meta template used, so
--    renewal_30 can migrate policy_renewal_v1 -> v2 -> _chinese without losing
--    reporting history. Null until the send job stamps the template it sent.
-- 6. scheduled_messages.idempotency_key is deterministic
--    (policy_id + message_type + scheduled_at) and UNIQUE. It is a belt-and-
--    suspenders guard on top of atomic claiming: even if infra double-fires,
--    the DB refuses a second row with the same key. Manual sends get a random
--    key (no policy_id to derive from). See scheduler + send-job docs.
-- 7. Retry backoff lives in next_retry_at. A failed message is only re-claimed
--    when next_retry_at <= now(). Exponential: 15m -> 1h -> 6h. After the max
--    attempt it stays 'failed' with next_retry_at = null and is surfaced on the
--    Health Dashboard for manual review. (Backoff logic implemented in M8.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

create type policy_type_enum as enum ('travel', 'car', 'home');

create type policy_status_enum as enum ('active', 'expired', 'cancelled');

-- 'manual' = agent-initiated one-off send from the Messages page.
-- Automated types map 1:1 to Meta template usage in lib/whatsapp/templates.ts.
create type message_type_enum as enum (
  'travel_departure',
  'travel_return',
  'renewal_60',
  'renewal_30',
  'renewal_7',
  'manual'
);

-- Lifecycle: pending -> processing (atomically claimed by send job)
--            processing -> sent | failed
--            failed (attempts < max, next_retry_at reached) -> re-claimed
--            failed (attempts >= max) -> terminal, surfaced on Health Dashboard
--            pending -> cancelled (policy edit/cancel, client delete, admin action)
create type scheduled_message_status_enum as enum (
  'pending', 'processing', 'sent', 'failed', 'cancelled'
);

create type message_direction_enum as enum ('outbound', 'inbound');

-- wechat / telegram are V2 placeholders. Only whatsapp is functional in V1.
create type platform_enum as enum ('whatsapp', 'wechat', 'telegram');

-- Mirrors Meta webhook status progression for outbound messages.
create type delivery_status_enum as enum ('queued', 'sent', 'delivered', 'read', 'failed');

create type job_status_enum as enum ('running', 'completed', 'failed');

-- ----------------------------------------------------------------------------
-- updated_at TRIGGER FUNCTION (shared by all tables)
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- AGENTS (tenant root — one row per authenticated user)
-- ----------------------------------------------------------------------------

create table agents (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null,
  phone_number text,                       -- agent's own number, used for test sends
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_agents_updated_at
  before update on agents
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- CLIENTS
-- ----------------------------------------------------------------------------

create table clients (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references agents (id) on delete cascade,
  full_name          text not null,
  phone_number       text not null,        -- E.164, normalized in app layer
  email              text,
  birthday           date,                 -- V2: birthday automation
  preferred_platform platform_enum not null default 'whatsapp',
  notes              text,
  deleted_at         timestamptz,          -- soft delete; UI filters on IS NULL
  version            integer not null default 1,  -- optimistic locking
  -- TODO (future multi-user-per-agent): created_by uuid references auth.users(id).
  -- Additive, nullable, no refactor required when a team shares one agent tenant.
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_clients_agent on clients (agent_id) where deleted_at is null;

-- Prevent the same active phone number twice under one agent.
-- Partial: a soft-deleted client's number can be re-added.
create unique index uq_clients_agent_phone
  on clients (agent_id, phone_number)
  where deleted_at is null;

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- POLICIES
-- ----------------------------------------------------------------------------

create table policies (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references agents (id) on delete cascade,
  client_id    uuid not null references clients (id) on delete cascade,
  policy_type  policy_type_enum not null,
  destination  text,                       -- travel only
  start_date   date not null,              -- travel: departure | car/home: policy start
  end_date     date not null,              -- travel: return    | car/home: policy end
  renewal_date date,                       -- car/home only; null for travel
  status       policy_status_enum not null default 'active',
  version      integer not null default 1, -- optimistic locking
  -- TODO (future multi-user-per-agent): created_by uuid references auth.users(id).
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Shape invariants enforced at the DB level so bad rows are impossible:
  constraint chk_dates_ordered
    check (end_date >= start_date),
  constraint chk_renewal_by_type
    check (
      (policy_type = 'travel' and renewal_date is null)
      or (policy_type in ('car', 'home') and renewal_date is not null)
    ),
  constraint chk_destination_travel_only
    check (policy_type = 'travel' or destination is null)
);

create index idx_policies_agent   on policies (agent_id);
create index idx_policies_client  on policies (client_id);
-- Dashboard "Upcoming Renewals" query: agent + date-range scan.
create index idx_policies_agent_renewal
  on policies (agent_id, renewal_date)
  where renewal_date is not null and status = 'active';

create trigger trg_policies_updated_at
  before update on policies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- SCHEDULED_MESSAGES (the reminder queue — hottest table in the system)
-- ----------------------------------------------------------------------------

create table scheduled_messages (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references agents (id) on delete cascade,
  client_id           uuid not null references clients (id) on delete cascade,
  policy_id           uuid references policies (id) on delete cascade,  -- null for manual sends
  message_type        message_type_enum not null,
  template_name       text,                   -- EXACT Meta template stamped at send time (versioning/debug)
  scheduled_at        timestamptz not null,   -- stored UTC; computed in Asia/Singapore
  status              scheduled_message_status_enum not null default 'pending',
  attempts            integer not null default 0,   -- max enforced in send job (M8)
  next_retry_at       timestamptz,            -- failed rows re-claimed only when this <= now()
  error_code          integer,                -- Meta Graph API numeric error code
  last_error          text,                   -- human-readable explanation
  sent_at             timestamptz,
  whatsapp_message_id text,                   -- Graph API message id (wamid)
  -- Deterministic for automated (policy_id + message_type + scheduled_at);
  -- random uuid for manual sends. UNIQUE across the table (see index below).
  idempotency_key     text,
  -- TODO (future multi-user-per-agent): created_by uuid references auth.users(id).
  -- Nullable add, no backfill needed, no refactor. Left as a comment only.
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Automated reminders must reference the policy they belong to.
  constraint chk_policy_required_for_automated
    check (message_type = 'manual' or policy_id is not null)
);

-- Duplicate prevention: one reminder per (policy, type). PARTIAL so an agent
-- can manually message the same client any number of times. This index is
-- what makes scheduler upserts safe on policy edits.
create unique index uq_scheduled_policy_type
  on scheduled_messages (policy_id, message_type)
  where message_type <> 'manual';

-- THE send-job index: "claim everything pending and due".
create index idx_scheduled_status_due
  on scheduled_messages (status, scheduled_at);

-- Retry claim path: "failed messages whose backoff has elapsed".
create index idx_scheduled_retry
  on scheduled_messages (next_retry_at)
  where status = 'failed' and next_retry_at is not null;

-- Deterministic idempotency guard: the DB physically cannot store two rows
-- with the same key, so a double-fire can never create a duplicate send.
create unique index uq_scheduled_idempotency
  on scheduled_messages (idempotency_key)
  where idempotency_key is not null;

create index idx_scheduled_agent  on scheduled_messages (agent_id);
create index idx_scheduled_client on scheduled_messages (client_id);

create trigger trg_scheduled_messages_updated_at
  before update on scheduled_messages
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- MESSAGE_LOGS (immutable audit trail — insert-only, no updated_at except
-- delivery_status which the webhook mutates by whatsapp_message_id)
-- ----------------------------------------------------------------------------

create table message_logs (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references agents (id) on delete cascade,
  client_id           uuid references clients (id) on delete set null,  -- null if inbound from unknown number
  direction           message_direction_enum not null,
  platform            platform_enum not null default 'whatsapp',
  message_type        text,                  -- template name or 'inbound'/'manual'
  body                text not null,         -- rendered message text as sent/received
  whatsapp_message_id text,
  delivery_status     delivery_status_enum,  -- outbound only; updated by webhook
  error_code          integer,               -- Meta numeric code on failure
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_logs_agent_time  on message_logs (agent_id, created_at desc);
create index idx_logs_client_time on message_logs (client_id, created_at desc);
-- Webhook delivery updates look up rows by wamid — must be indexed.
create index idx_logs_wamid on message_logs (whatsapp_message_id)
  where whatsapp_message_id is not null;

create trigger trg_message_logs_updated_at
  before update on message_logs
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- JOB_RUNS (observability — one row per send-job execution)
-- Feeds the Health Dashboard: last run, success rate, durations.
-- ----------------------------------------------------------------------------

create table job_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null,               -- 'send-due-messages'
  status        job_status_enum not null default 'running',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  claimed_count integer not null default 0,
  sent_count    integer not null default 0,
  failed_count  integer not null default 0,
  duration_ms   integer,                     -- total job wall time
  avg_send_ms   integer,                     -- mean WhatsApp API latency this run
  error         text,                        -- fatal job-level error, if any
  created_at    timestamptz not null default now()
);

create index idx_job_runs_name_time on job_runs (job_name, started_at desc);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — deny-by-default
-- Enabling RLS with no policies blocks ALL anon/authenticated access until
-- Milestone 4 defines tenant policies. Service role (send job, webhook)
-- bypasses RLS by design.
-- ----------------------------------------------------------------------------

alter table agents             enable row level security;
alter table clients            enable row level security;
alter table policies           enable row level security;
alter table scheduled_messages enable row level security;
alter table message_logs       enable row level security;
alter table job_runs           enable row level security;
