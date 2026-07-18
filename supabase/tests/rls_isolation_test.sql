-- rls_isolation_test.sql
-- Verifies tenant isolation under RLS as the non-superuser `authenticated` role,
-- with auth.uid() driven by request.jwt.claims (faithful Supabase behavior).
-- Prints PASS/FAIL lines; a summary is computed by the shell wrapper.

\set ON_ERROR_STOP off

-- Helper: run as a given tenant by setting role + JWT claim, return rowcount
-- We use explicit transactions with SET LOCAL so each "session" is isolated.

-- Tenant UUIDs
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- ---- Setup: two auth users -> trigger auto-creates two agents ----
insert into auth.users (id, email, raw_user_meta_data)
values (:'A', 'a@test.com', '{"full_name":"Agent A"}'::jsonb),
       (:'B', 'b@test.com', '{"full_name":"Agent B"}'::jsonb);

-- Confirm the signup trigger created agents rows (as superuser, bypassing RLS)
select case when count(*) = 2 then 'PASS: signup trigger created 2 agents'
            else 'FAIL: expected 2 agents, got ' || count(*) end
from public.agents where id in (:'A', :'B');

-- ============================================================================
-- Tenant A inserts a client (as authenticated, claim sub = A)
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
insert into public.clients (agent_id, full_name, phone_number)
values (:'A', 'Alice (A''s client)', '+6591110001');
select case when count(*) = 1 then 'PASS: A can insert + read own client'
            else 'FAIL: A cannot see own client' end
from public.clients;
commit;

-- ============================================================================
-- Tenant B tries to READ A's clients -> must see ZERO
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
select case when count(*) = 0 then 'PASS: B sees none of A''s clients (isolation)'
            else 'FAIL: B leaked ' || count(*) || ' of A''s clients' end
from public.clients;
commit;

-- ============================================================================
-- Tenant B tries to INSERT a client stamped with A's agent_id -> must FAIL
-- (WITH CHECK tenant-spoof defense)
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
insert into public.clients (agent_id, full_name, phone_number)
values (:'A', 'Spoofed', '+6599999999');
commit;
-- If the insert above succeeded, this will find the spoofed row (as superuser):
reset role;
select case when count(*) = 0 then 'PASS: B blocked from inserting row as A (WITH CHECK)'
            else 'FAIL: B spoofed a client into A''s tenant' end
from public.clients where full_name = 'Spoofed';

-- ============================================================================
-- Tenant B tries to UPDATE / DELETE A's client -> zero rows affected
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
with upd as (
  update public.clients set notes = 'hacked' where full_name = 'Alice (A''s client)' returning 1
)
select case when count(*) = 0 then 'PASS: B''s UPDATE of A''s client affected 0 rows'
            else 'FAIL: B updated A''s client' end from upd;
with del as (
  delete from public.clients where full_name = 'Alice (A''s client)' returning 1
)
select case when count(*) = 0 then 'PASS: B''s DELETE of A''s client affected 0 rows'
            else 'FAIL: B deleted A''s client' end from del;
commit;

-- Confirm A's client survived untouched
reset role;
select case when count(*) = 1 then 'PASS: A''s client intact after B''s attacks'
            else 'FAIL: A''s client was modified/removed' end
from public.clients where full_name = 'Alice (A''s client)' and notes is distinct from 'hacked';

-- ============================================================================
-- message_logs: agent read is scoped; authenticated INSERT is denied
-- ============================================================================
-- Seed a log for A via service role (superuser here stands in for service role)
reset role;
insert into public.message_logs (agent_id, direction, platform, body)
values (:'A', 'outbound', 'whatsapp', 'hello from A');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
select case when count(*) = 0 then 'PASS: B cannot read A''s message_logs'
            else 'FAIL: B read A''s logs' end from public.message_logs;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
select case when count(*) = 1 then 'PASS: A can read own message_logs'
            else 'FAIL: A cannot read own logs' end from public.message_logs;
-- A tries to INSERT a log -> should be denied (no insert grant/policy)
insert into public.message_logs (agent_id, direction, platform, body)
values (:'A', 'outbound', 'whatsapp', 'agent-written');
commit;
reset role;
select case when count(*) = 0 then 'PASS: authenticated INSERT into message_logs denied'
            else 'FAIL: agent wrote directly to message_logs' end
from public.message_logs where body = 'agent-written';

-- ============================================================================
-- job_runs: authenticated cannot read at all
-- ============================================================================
reset role;
insert into public.job_runs (job_name, status) values ('send-due-messages', 'completed');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
-- Expect a permission-denied error (no grant). Wrap to catch it as a result.
do $$
begin
  perform 1 from public.job_runs;
  raise notice 'FAIL: authenticated read job_runs';
exception when insufficient_privilege then
  raise notice 'PASS: authenticated denied on job_runs (permission denied)';
end $$;
commit;

reset role;
