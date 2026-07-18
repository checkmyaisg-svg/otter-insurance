\set ON_ERROR_STOP off
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- Two agents (trigger auto-creates agents rows)
insert into auth.users (id,email,raw_user_meta_data) values
 (:'A','a@t.com','{"full_name":"A"}'::jsonb),
 (:'B','b@t.com','{"full_name":"B"}'::jsonb);

-- Agent A creates a client (as authenticated)
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
insert into public.clients (agent_id, full_name, phone_number) values (:'A','Alice','+6591110001');
commit;

-- Grab A's client id (superuser)
reset role;
\set client_a `echo`
select id as client_a from public.clients where agent_id = :'A' \gset

-- ============================================================================
-- TEST 1: create_policy_with_reminders — atomic policy + reminders (car, far future)
-- 60/30/7 reminders all in the future -> expect 3 reminders + 1 policy
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
select public.create_policy_with_reminders(
  json_build_object('id','aaaaaaaa-0000-0000-0000-000000000001','client_id', :'client_a',
    'policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-01')::jsonb,
  json_build_array(
    json_build_object('messageType','renewal_60','scheduledAt','2027-10-02T01:00:00Z','templateName','policy_renewal_v1','idempotencyKey','k60'),
    json_build_object('messageType','renewal_30','scheduledAt','2027-11-01T01:00:00Z','templateName','policy_renewal_v1','idempotencyKey','k30'),
    json_build_object('messageType','renewal_7','scheduledAt','2027-11-24T01:00:00Z','templateName','policy_renewal_v1','idempotencyKey','k7')
  )::jsonb
) as new_policy_id;
commit;

reset role;
select case when (select count(*) from public.policies where agent_id=:'A')=1
             and (select count(*) from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and status='pending')=3
        then 'PASS: create RPC inserted policy + 3 reminders atomically'
        else 'FAIL: create RPC did not persist expected rows' end;

-- ============================================================================
-- TEST 2: atomic rollback — a bad reminder (invalid enum) must roll back the policy too
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
select public.create_policy_with_reminders(
  json_build_object('id','aaaaaaaa-0000-0000-0000-000000000002','client_id', :'client_a',
    'policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-01')::jsonb,
  json_build_array(
    json_build_object('messageType','NOT_A_REAL_TYPE','scheduledAt','2027-10-02T01:00:00Z','templateName','x','idempotencyKey','bad')
  )::jsonb
);
commit;
reset role;
select case when not exists (select 1 from public.policies where id='aaaaaaaa-0000-0000-0000-000000000002')
        then 'PASS: failed reminder rolled back the whole policy (atomicity)'
        else 'FAIL: policy persisted despite reminder failure' end;

-- ============================================================================
-- TEST 3: tenant isolation through the RPC — B cannot create a policy for A's client
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, true);
select public.create_policy_with_reminders(
  json_build_object('id','bbbbbbbb-0000-0000-0000-000000000001','client_id', :'client_a',
    'policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-01')::jsonb,
  '[]'::jsonb
);
commit;
reset role;
select case when not exists (select 1 from public.policies where id='bbbbbbbb-0000-0000-0000-000000000001')
        then 'PASS: B blocked from creating policy on A''s client (client_not_found via RLS)'
        else 'FAIL: B created a policy on A''s client' end;

-- ============================================================================
-- TEST 4: optimistic locking — stale version raises version_conflict
-- ============================================================================
-- current version is 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
do $$
begin
  perform public.update_policy_with_reminders(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    99,  -- WRONG expected version
    json_build_object('client_id','','policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-01','status','active')::jsonb,
    '[]'::jsonb, '[]'::jsonb, array[]::uuid[]
  );
  raise notice 'FAIL: stale version did not conflict';
exception
  when sqlstate 'PT409' then raise notice 'PASS: stale version raised version_conflict (PT409)';
end $$;
commit;

-- ============================================================================
-- TEST 5: successful update bumps version and reconciles (move renewal date)
-- Move renewal so all 3 reminder times change -> 3 updates, version 1->2
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
select public.update_policy_with_reminders(
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  1,  -- correct version
  json_build_object('client_id', :'client_a','policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-15','status','active')::jsonb,
  '[]'::jsonb,
  json_build_array(
    json_build_object('id', (select id from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and message_type='renewal_60'), 'scheduledAt','2027-10-16T01:00:00Z','idempotencyKey','k60b')
  )::jsonb,
  array[]::uuid[]
) as new_version;
commit;
reset role;
select case when (select version from public.policies where id='aaaaaaaa-0000-0000-0000-000000000001')=2
             and (select scheduled_at from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and message_type='renewal_60') = '2027-10-16T01:00:00Z'::timestamptz
        then 'PASS: update bumped version to 2 and reconciled a reminder time'
        else 'FAIL: update/reconcile did not apply' end;

-- ============================================================================
-- TEST 6: cancel via update (status=cancelled) cancels all pending reminders
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, true);
select public.update_policy_with_reminders(
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  2,
  json_build_object('client_id', :'client_a','policy_type','car','start_date','2027-01-01','end_date','2028-01-01','renewal_date','2027-12-15','status','cancelled')::jsonb,
  '[]'::jsonb, '[]'::jsonb,
  (select array_agg(id) from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and status='pending')
);
commit;
reset role;
select case when (select count(*) from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and status='pending')=0
             and (select count(*) from public.scheduled_messages where policy_id='aaaaaaaa-0000-0000-0000-000000000001' and status='cancelled')=3
        then 'PASS: policy cancel cancelled all 3 pending reminders'
        else 'FAIL: reminders not cancelled on policy cancel' end;
