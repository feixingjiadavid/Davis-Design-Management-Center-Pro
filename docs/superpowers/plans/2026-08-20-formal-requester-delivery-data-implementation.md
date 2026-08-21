# Formal Requester Delivery Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Pro UAT requester-facing design delivery and AI conversation onto formal, AI-neutral tables and render them through the formal requester page structure.

**Architecture:** Keep `uat_design_generations` as the AI console audit source. Publish only complete deliverables into `design_versions` plus Storage-backed `design_version_assets`; mirror requester-visible conversation into `task_ai_messages`. Replace requester-only UAT galleries with one formal delivery library.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Supabase Edge Functions (Deno/TypeScript), Supabase Storage, browser ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-formal-requester-delivery-data-design.md`

## Global Constraints

- Do not modify the formal-system repository.
- `design_versions.status` supports exactly `draft`, `pending_review`, `revision`, and `accepted`.
- Requester-facing images come only from Supabase Storage URLs stored in `design_version_assets.asset_url`.
- `uat_design_generations` and all AI technical fields remain AI-console-only.
- Do not add a second requester version gallery or a new page design.

---

### Task 1: Canonical delivery migration

**Files:**
- Create: `supabase/migrations/<timestamp>_formal_design_delivery_tables.sql`
- Create: `tests/formal-design-delivery-migration.test.mjs`

**Interfaces:**
- Produces: `design_versions`, `design_version_assets`, `task_ai_messages`, their constraints, indexes, grants, and RLS policies.

- [ ] Write a failing source test that asserts the approved columns, four status values, foreign keys, unique version ordering, explicit grants, and RLS.
- [ ] Run the test and verify it fails because the migration does not exist.
- [ ] Generate the migration filename with `supabase migration new formal_design_delivery_tables`.
- [ ] Add the three tables, constraints, indexes, grants, RLS policies, realtime publication, and safe communication backfill.
- [ ] Run the migration source test and SQL lint/static validation.
- [ ] Apply the migration to the linked UAT project when credentials are available and query the resulting catalog and Data API.

### Task 2: Formal version publisher

**Files:**
- Modify: `supabase/functions/uat-seedream-worker/index.ts`
- Create: `supabase/functions/uat-seedream-worker/formal-version-publisher.mjs`
- Create: `supabase/functions/uat-seedream-worker/formal-version-publisher.test.mjs`

**Interfaces:**
- Consumes: complete ready generation groups with provider image URLs.
- Produces: durable `designs` bucket objects, one version row, and ordered asset rows.

- [ ] Write failing tests for framework `v1`, revision `v2+`, stable ordering, idempotency, and exclusion of incomplete runs.
- [ ] Implement provider-image persistence to Supabase Storage and pure publication payload construction.
- [ ] Replace delivery writes to `history_json` in framework and revision completion with idempotent formal table publication.
- [ ] Retain all `uat_design_generations` console audit writes.
- [ ] Run worker and generation regression tests.

### Task 3: Canonical AI conversation

**Files:**
- Modify: `supabase/functions/uat-ai-design/clarification-chat.ts`
- Modify: `js/ai-requirement-client.js`
- Test: existing clarification tests plus a new canonical-message test.

**Interfaces:**
- Consumes: AI question and requester answer events.
- Produces: `task_ai_messages` rows with only `ai` or `requester` senders.

- [ ] Write failing tests for sender mapping and exclusion of system messages.
- [ ] Mirror AI questions and requester answers into the canonical message table in the service-role Edge Function.
- [ ] Read requester communication only from `task_ai_messages`.
- [ ] Run clarification and requester communication tests.

### Task 4: Formal requester renderer

**Files:**
- Modify: `task-detail-requester.html`
- Modify: `js/task-detail-requester.js`
- Replace or remove requester boot imports in `supabase-config.js`
- Create/modify a focused pure renderer module and tests.

**Interfaces:**
- Consumes: versions ordered by `version_no`, assets ordered by `sort_order`, and canonical AI messages.
- Produces: one historical delivery library and the existing image modal interaction.

- [ ] Write failing tests for the required section order, formal version cards, newest badge, statuses, and forbidden-content guards.
- [ ] Place the communication section after visual references and before the version library.
- [ ] Query only canonical version/asset/message tables for requester-specific content.
- [ ] Remove requester boot imports and DOM hosts for Demo, current delivery, generation history, and Drive preview.
- [ ] Preserve the formal task details, materials, references, approval panel, timeline, upload entry, and in-system modal.
- [ ] Run requester regression and source isolation tests.

### Task 5: End-to-end verification

**Files:**
- No production files unless verification exposes a defect.

**Interfaces:**
- Verifies: requirement → AI question → requester reply → v1 → revision → v2 → acceptance.

- [ ] Run migration/catalog/Data API checks.
- [ ] Run all focused Node/Deno tests and syntax checks.
- [ ] Verify AI console bootstrap still loads generation diagnostics.
- [ ] Verify requester source and rendered DOM contain no model, Seedream, Drive, run ID, retry, failed, or generation-log content.
- [ ] Exercise thumbnail click and confirm the existing modal opens without navigation.
- [ ] Record any environment limitation honestly and leave the worktree scoped to this task.
