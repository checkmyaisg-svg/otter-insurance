# Future: Immutable Business Audit Log (NOT YET IMPLEMENTED)

> Status: **placeholder / design intent only.** No code, table, or trigger for
> this exists yet. This document reserves the design so it can be added later
> without reworking the schema or the server actions.

## Purpose

A tamper-resistant, append-only record of important business actions, separate
from `message_logs` (which is a communications log, not a business-action log).
This audit trail answers "who did what, when, and to which record" for support,
dispute resolution, and eventually compliance.

## Actions to capture

| Action | Trigger point |
|---|---|
| Client created | `createClient` server action |
| Client updated | `updateClient` server action |
| Client deleted (soft) | `deleteClient` server action |
| Policy created | `createPolicy` server action |
| Policy updated | `updatePolicy` server action |
| Policy renewed | renewal flow (future) |
| Reminder cancelled | `cancelReminder` / policy reconcile |
| Reminder rescheduled | `rescheduleReminder` / policy reconcile |
| Manual WhatsApp send | manual-send action (Milestone 12) |
| CSV import | bulk import (future) |
| Login | auth callback / sign-in |
| Settings changed | settings actions (Milestone 13) |

## Proposed shape (for when we build it)

A single `audit_events` table, insert-only:

- `id` uuid
- `agent_id` uuid — tenant key (same RLS pattern: read own rows only)
- `actor_id` uuid — which user performed it (ties into the role work below)
- `action` enum — the actions above
- `entity_type` text / `entity_id` uuid — what was affected
- `summary` text — human-readable one-liner
- `metadata` jsonb — before/after diff or action-specific detail
- `created_at` timestamptz

## Immutability approach (to decide at build time)

- RLS: `SELECT` only for authenticated agents (own `agent_id`); **no**
  `UPDATE`/`DELETE` policy for anyone, including the writing path.
- Writes happen server-side via the service role (same pattern as
  `message_logs`), or via a `SECURITY DEFINER` insert-only function.
- Consider a `REVOKE UPDATE, DELETE` at the role level and/or a `BEFORE
  UPDATE/DELETE` trigger that raises, to make tampering impossible even for the
  service role.

## Why not now

Auditing every action adds a write to every mutation path and a schema surface
we'd have to migrate carefully. It is deferred until the core CRUD, scheduling,
and send pipeline are proven. The server actions built in Milestone 5 are the
natural hook points; adding audit calls later is additive, not a refactor.
