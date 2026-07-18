# Vision

Build an Insurance Client Automation Platform that helps insurance agents know
exactly what needs their attention every day.

# Product Philosophy

The platform should reduce manual administrative work, automate routine
follow-ups, and surface actionable tasks instead of raw data.

The dashboard should answer one question:

**"What should I do today?"**

# Engine Architecture

The platform is organized as **engines**, not pages. An engine is a business
domain (`lib/` data-access + server actions + components). Pages compose
engines; they never own business logic. Every engine should be able to answer
"what in my domain needs attention?" — even if V1 derives that answer on the fly.

### Client Engine
- Client profiles
- Contact information
- Notes
- Relationships

### Policy Engine
- Travel
- Home
- Car
- Renewals
- Reminder generation

### Messaging Engine
- WhatsApp
- Scheduled messages
- History
- Future AI drafts

### Campaign Engine (Future)
- Event announcements
- Image uploads
- Broadcast messaging
- Audience selection

### Task Engine
Every engine should emit events that can become actionable tasks
(renewal due, client replied, payment promised, trip tomorrow, failed message,
manual follow-up required).

The dashboard should **aggregate** tasks rather than own business logic.

Implementation note: in V1 most tasks are **derived** (computed by querying
existing tables — no new table needed). In V2, reply-driven tasks that carry
their own state gain a **persisted** store. The dashboard calls a stable
`getTodaysTasks()`-style interface in both cases; only the implementation grows.

### AI contract (V2)
Every incoming WhatsApp message should eventually produce:
- Intent
- Urgency
- Suggested CRM status
- Suggested reply
- Suggested next task

**The agent must always review and approve outbound replies before sending.**
AI suggests; it never sends autonomously and never silently changes payment or
status.

# Product Roadmap

### Version 0.2 — "Hold the whole book" (system of record)
- Policy Engine: 6 types (life, health, ci, car, home, travel) mapped onto
  3 behaviors (protection / renewable / event). New types inherit behaviors
  via a one-line mapping — no refactor.
- Policy money fields: insurer, policy number, premium amount, payment mode,
  sum assured, riders (display-only JSON).
- Protection scheduling behavior (premium-due + anniversary); Renewable and
  Event schedulers reused unchanged.
- Bulk Policy Import (CSV with column mapping, reusing the import pipeline).
- Dashboard task completion (mark done / snooze — small persisted task store).
- Reserved, not implemented: policy holder, insured person, documents.

### Version 0.3 — "Messages actually go out" (outbound spine)
- WhatsApp Business Cloud API connection + template management
- Daily send job (pending -> sent/failed; failures surface on Today)
- Manual follow-up tasks with dates
- Action View v1 (dashboard items open a focused context panel)

### Version 0.4 — "Close the loop" (primary-workspace unlock)
- Inbound WhatsApp webhook -> per-client threads
- Conversation view + in-app reply (24h-window aware)
- Replies surface on Today; reply-driven persisted tasks

### Version 0.5 — "Retention amplifiers"
- Birthday automation
- Google Calendar sync
- Prospect/pipeline stage
- Broadcast/campaign groundwork (compliance lane)

### Later
- AI classification and drafts (per AI contract above)
- OCR, voice notes, WeChat, Telegram, analytics, commissions

# Guiding Principles

1. Business logic lives in engines (`lib/` + server actions), never in pages
   or the dashboard.
2. Every engine can answer "what needs attention?" for its domain.
3. The dashboard aggregates; it never computes domain logic.
4. AI suggests, the agent approves — no autonomous outbound messaging.
5. Ship a polished V1 before implementing V2 AI features.
6. Do not over-engineer Version 1.

---
_This document is the source of truth for the project. Update it as the product
evolves._
