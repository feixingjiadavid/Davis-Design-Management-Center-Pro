# Formal Requester Delivery Data Design

## Goal

Make the Pro UAT requester task detail use the same presentation boundary as the formal system: task information and workflow remain formal-system concepts, while AI-only execution records remain confined to the AI Designer Console.

## Source of truth

The latest formal-system `task-detail-requester.html` at commit `11a0a1e` is the structural and interaction reference. It has one historical delivery library and an in-system image preview modal. Pro UAT must not derive requester-facing versions from generation attempts.

## Canonical data model

`design_versions` represents human-compatible delivery submissions. `version_no` is unique inside a task. `version_type` is one of `framework`, `revision`, or `final`. `status` is one of the four approved formal states: `draft`, `pending_review`, `revision`, or `accepted`.

`design_version_assets` stores ordered requester-facing images for one version. Every `asset_url` is a durable Supabase Storage URL. Drive IDs, provider URLs, temporary URLs, model names, prompts, run IDs, generation states, and retry details are forbidden.

`task_ai_messages` stores only AI/requester conversation. `sender_type` is `ai` or `requester`. System audit messages are not requester communication and are not copied into this table.

## Security and API exposure

All three tables are in `public`, explicitly granted to the roles that need the Data API, and have RLS enabled. Authenticated task participants may read rows for tasks they can access. Requester-facing review actions may update only the `status` column of `design_versions`. Inserts and all other mutations are performed by existing service-role Edge Functions.

## AI publishing boundary

`uat_design_generations` remains the complete AI-console audit source. A generation row never appears on the requester page. When every page in one deliverable is ready, the worker copies each provider result into the public `designs` Supabase Storage bucket, then idempotently publishes one `design_versions` row and its ordered `design_version_assets` rows.

Framework attempts publish or replace `v1` until leadership accepts the framework. Content revision `n` publishes `version_no = n + 1`. Rejection marks the reviewed version `revision`; acceptance marks the latest reviewable version `accepted`. Failed, cancelled, queued, and partial runs publish nothing.

Generation completion no longer appends delivery images or AI metadata to `test_tasks.history_json`. Workflow actions may continue using `history_json` for the formal approval timeline, but the requester version gallery never reads image data from it.

## Communication boundary

The existing clarification workflow remains responsible for AI reasoning and question state. Its AI questions and requester answers are also written to `task_ai_messages`. Existing requester-visible conversation is backfilled from `uat_clarification_messages`; system-only records are excluded.

## Requester page

The left-column order is:

1. Requirement details
2. Required design assets
3. Visual/style references
4. AI designer communication
5. Designer historical delivery library

The delivery library reads only `design_versions` and `design_version_assets`, renders every historical version in ascending order, marks the newest version, and opens asset images in the existing in-system modal. It never imports Drive preview, generation history, framework Demo, or current-delivery modules.

The existing formal acceptance and approval panel remains the workflow action surface. AI communication does not determine or mutate version rendering.

## Compatibility

No formal-system repository file is modified. Table and field meanings are independent of AI and can be written by a human designer flow after a future merge. UAT-only tables may coexist for console diagnostics, but requester modules do not depend on them.

## Verification

- Migration assertions cover columns, constraints, indexes, grants, RLS, and policies.
- Worker tests prove partial or failed generations do not publish and complete sets publish one ordered formal version.
- Communication tests prove only AI/requester messages enter the formal conversation table.
- Requester renderer tests prove version ordering, latest marking, status copy, modal-only image behavior, and absence of forbidden technical terms.
- Source guards prove the requester bootstrap does not import generation/Drive modules and the AI console still does.
