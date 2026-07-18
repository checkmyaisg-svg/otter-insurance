-- ============================================================================
-- CLEANUP: removes ALL demo data created by dashboard_demo_data.sql.
-- Deletes every client whose name starts with "DEMO —" (and cascades to their
-- policies + scheduled_messages), plus the demo scheduled message.
-- ============================================================================

-- Remove the standalone demo scheduled message (if the policy wasn't cascaded).
delete from public.scheduled_messages where idempotency_key = 'demo-today-1';

-- Deleting the DEMO clients cascades to their policies and scheduled_messages.
delete from public.clients where full_name like 'DEMO —%';
