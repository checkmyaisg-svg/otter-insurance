-- ============================================================================
-- DEMO DATA for the Today dashboard.  ⚠️ DEMO ONLY — safe to delete anytime.
-- Every record is prefixed "DEMO —" so it's obvious and easy to remove.
-- Run the cleanup script (dashboard_demo_cleanup.sql) to wipe all of it.
--
-- Dates are computed relative to CURRENT_DATE so every dashboard section
-- lights up no matter when you run this.
--
-- NOTE: run this in the Supabase SQL Editor while logged in as the agent whose
-- dashboard you want to populate. It resolves that agent automatically from the
-- single existing agents row. If you have more than one agent, edit v_agent.
-- ============================================================================

do $$
declare
  v_agent uuid;
  c_overdue uuid; c_soon uuid; c_month uuid; c_travel uuid; c_today uuid;
  p_overdue uuid; p_travel uuid;
begin
  -- Resolve the target agent (assumes a single agent; adjust if needed).
  select id into v_agent from public.agents order by created_at limit 1;
  if v_agent is null then
    raise exception 'No agent found — sign up first.';
  end if;

  -- ---- DEMO clients ----
  insert into public.clients (agent_id, full_name, phone_number, notes)
  values (v_agent, 'DEMO — Overdue Olivia', '+6580000001', 'DEMO')
  returning id into c_overdue;

  insert into public.clients (agent_id, full_name, phone_number, notes)
  values (v_agent, 'DEMO — Followup Farid', '+6580000002', 'DEMO')
  returning id into c_soon;

  insert into public.clients (agent_id, full_name, phone_number, notes)
  values (v_agent, 'DEMO — Renewal Rina', '+6580000003', 'DEMO')
  returning id into c_month;

  insert into public.clients (agent_id, full_name, phone_number, notes)
  values (v_agent, 'DEMO — Travel Tariq', '+6580000004', 'DEMO')
  returning id into c_travel;

  insert into public.clients (agent_id, full_name, phone_number, notes)
  values (v_agent, 'DEMO — Today Tina', '+6580000005', 'DEMO')
  returning id into c_today;

  -- ---- 1. Needs Attention: overdue renewal (renewal in the past) ----
  insert into public.policies (agent_id, client_id, policy_type, start_date, end_date, renewal_date, status)
  values (v_agent, c_overdue, 'car', current_date - 300, current_date + 65, current_date - 5, 'active')
  returning id into p_overdue;

  -- ---- 2. Follow Up Today: renewal ~10 days out (within 14d window) ----
  insert into public.policies (agent_id, client_id, policy_type, start_date, end_date, renewal_date, status)
  values (v_agent, c_soon, 'home', current_date - 355, current_date + 10, current_date + 10, 'active');

  -- ---- 5. Upcoming Renewals: renewal ~25 days out (15–30d window) ----
  insert into public.policies (agent_id, client_id, policy_type, start_date, end_date, renewal_date, status)
  values (v_agent, c_month, 'car', current_date - 340, current_date + 25, current_date + 25, 'active');

  -- ---- 4. Upcoming Travel: departs in 3 days ----
  insert into public.policies (agent_id, client_id, policy_type, destination, start_date, end_date, status)
  values (v_agent, c_travel, 'travel', 'DEMO — Tokyo', current_date + 3, current_date + 12, 'active')
  returning id into p_travel;

  -- ---- 3. Scheduled Today: a reminder dated today (manual type, pending) ----
  -- Uses a real policy_id (the overdue car) but message_type 'manual' so it
  -- doesn't collide with the auto-generated renewal reminders.
  insert into public.scheduled_messages (agent_id, client_id, policy_id, message_type, scheduled_at, status, idempotency_key)
  values (v_agent, c_today, p_overdue, 'manual', (current_date::timestamptz + interval '9 hours'), 'pending', 'demo-today-1');

  raise notice 'DEMO data inserted for agent %', v_agent;
end $$;
