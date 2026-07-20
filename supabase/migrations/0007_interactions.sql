-- 0007_interactions.sql
-- INTERACTION INTELLIGENCE: the ground truth of client contact.
-- 1. interactions: one row per real-world touchpoint (call, meeting,
--    WhatsApp outside Prospekt, email, note). Feeds last-contact across the
--    intelligence, revenue, and gone-quiet engines.
-- 2. clients gains occupation + dependants: life-situation fields that turn
--    the Opportunity Engine from coverage-gap guessing into reasoning.
-- Follows the RLS pattern of every existing table: agents see only their rows.

create type interaction_type_enum as enum ('call', 'meeting', 'whatsapp', 'email', 'note');

create table interactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  interaction_type interaction_type_enum not null,
  occurred_at date not null default (now() at time zone 'Asia/Singapore')::date,
  note text,
  created_at timestamptz not null default now()
);

create index interactions_client_idx on interactions (client_id, occurred_at desc);
create index interactions_agent_idx on interactions (agent_id, occurred_at desc);

alter table interactions enable row level security;

create policy "agents read own interactions" on interactions
  for select using (agent_id = auth.uid());
create policy "agents insert own interactions" on interactions
  for insert with check (agent_id = auth.uid());
create policy "agents delete own interactions" on interactions
  for delete using (agent_id = auth.uid());

alter table clients
  add column occupation text,
  add column dependants smallint check (dependants >= 0 and dependants <= 20);
