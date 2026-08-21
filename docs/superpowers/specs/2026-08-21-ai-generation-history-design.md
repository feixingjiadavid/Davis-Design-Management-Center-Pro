# AI Designer Generation History Design

## Goal

Replace the AI Designer Workspace's duplicated `Seedream Demo · Google Drive 持久化预览` presentation with one business-facing, fully traceable `AI全阶段生成结果` timeline.

The timeline must cover requirement understanding, initial framework generation, framework revisions, content revisions, and the final design. It shows business batches, their images, change reasons, summaries, and processing states. It never exposes providers, models, prompts, run IDs, Drive data, storage internals, retry logs, or raw error details.

## Scope and non-goals

This change applies only to the AI Designer Workspace. It does not change `task-detail-requester.html`, the requester version library, or the requester acceptance flow.

The existing AI execution controls, orchestrator, worker, retry capability, and technical audit data remain intact. `uat_design_generations` continues to store complete operational records for debugging and execution. This design does not delete that table and does not reduce the AI console's ability to run or diagnose generation jobs.

The redundant Seedream/Drive preview component is deleted rather than renamed or moved. `AI全阶段生成结果` becomes the only historical AI process presentation.

## Architecture decision

The workspace receives a sanitized business read model rather than reading operational generation rows directly:

```text
UAT analysis/revision/generation records
                |
                v
private projection functions and triggers
                |
                v
ai_generation_runs -> ai_generation_assets
                |
                v
AI全阶段生成结果
```

The operational tables remain the source events. The new tables are the canonical read model for the workspace timeline. Projection is idempotent and transactionally follows source inserts and updates, so the browser never reconstructs business batches from page-level attempts.

Projection functions live in a non-exposed `private` schema. They use `security definer set search_path = ''`, fully qualified object names, and have execution revoked from `public`, `anon`, and `authenticated`. Only table triggers and trusted service-role paths may invoke them.

## Canonical schema

### `public.ai_generation_runs`

One row represents one user-understandable stage or generation/modification batch.

| Column | Definition |
| --- | --- |
| `id` | UUID primary key, default `gen_random_uuid()` |
| `task_id` | Text, required, references `public.test_tasks(id)` with cascade delete |
| `sequence_no` | Positive integer, required; unique within a task and used for ascending timeline order |
| `run_type` | Required: `requirement_analysis`, `framework_generation`, `framework_revision`, `content_revision`, or `final_design` |
| `revision_no` | Positive integer when the source has an explicit revision number; otherwise null |
| `title` | Required business label such as `需求理解`, `框架生成`, or `第1次内容修改` |
| `change_reason` | Sanitized requester/leader reason; empty when the stage is not a modification |
| `ai_summary` | Sanitized business summary; no prompt, model, run ID, provider response, or error stack |
| `status` | Required: `queued`, `processing`, `waiting_input`, `completed`, `failed`, or `cancelled` |
| `source_type` | Internal linkage: `requirement_analysis`, `framework_batch`, `framework_adjustment`, or `content_revision` |
| `source_id` | Internal stable source identifier used for idempotent upsert; never rendered |
| `started_at` | Nullable timestamp with time zone |
| `completed_at` | Nullable timestamp with time zone |
| `created_at` | Timestamp with time zone, default now |
| `updated_at` | Timestamp with time zone, default now and maintained on update |

Constraints and indexes:

- Unique `(task_id, sequence_no)`.
- Unique `(task_id, source_type, source_id)`.
- Check constraints enforce enumerated `run_type`, `status`, positive `sequence_no`, and positive-or-null `revision_no`.
- Index `(task_id, sequence_no asc)` supports the timeline query.
- Index `(task_id, status)` supports active-batch inspection.

`source_type` and `source_id` exist only to make synchronization repeatable. They are selected only by trusted backend code and are excluded from the workspace rendering contract.

### `public.ai_generation_assets`

One row represents one durable image belonging to a business batch.

| Column | Definition |
| --- | --- |
| `id` | UUID primary key, default `gen_random_uuid()` |
| `generation_run_id` | Required UUID referencing `ai_generation_runs(id)` with cascade delete |
| `asset_url` | Required Supabase Storage public URL |
| `asset_type` | Required, initially `image` |
| `page_no` | Positive integer when the image represents a numbered page |
| `sort_order` | Non-negative integer, required |
| `caption` | Sanitized optional page caption |
| `created_at` | Timestamp with time zone, default now |

Constraints and indexes:

- Unique `(generation_run_id, sort_order)`.
- Index `(generation_run_id, sort_order asc)` supports ordered image rendering.
- `asset_url` must match the configured public Supabase Storage origin and `/storage/v1/object/public/designs/` path. Drive URLs, provider URLs, signed temporary URLs, and arbitrary external hosts are rejected by projection and by a database check constraint.

The database stores the complete public URL so the workspace renders `asset.asset_url` directly. It does not call `getPublicUrl()` and does not construct a URL from technical object metadata.

## Stage mapping

### Requirement understanding

Each business analysis cycle in `uat_requirement_analyses` projects to one `requirement_analysis` run. The title is `需求理解` for the first analysis and a numbered business label for later analysis cycles. The row may have no assets.

Its summary comes only from an approved, sanitized analysis summary. Status maps to the six public business states. A stage waiting for requester answers maps to `waiting_input`.

### Initial framework generation

Page-level `uat_design_generations` rows with `generation_mode = 'initial_framework'` are grouped by their analysis/batch source key into one `framework_generation` run. Their public Storage images become ordered assets.

### Framework revision

Rows with `generation_mode = 'framework_revision'` are grouped by `framework_adjustment_id`. `change_reason` is built from the adjustment's requester direction and leader feedback, excluding empty values and technical content. Supplemental business instructions may contribute to `ai_summary`, but raw prompts do not.

### Content revision

Rows with `generation_mode = 'content_revision'` are grouped by `revision_id`. `revision_no`, title, and reason come from `uat_content_revisions`. The reason uses its business change summary and requester feedback, never provider output.

### Final design

When the final content-revision batch is accepted, that batch is represented as `final_design` rather than creating a duplicated second image batch. Its title changes to `最终设计`, status becomes `completed`, and the same run retains its ordered assets. This prevents the final images from appearing twice.

## Ordering and status aggregation

The timeline is ordered by `sequence_no ASC`: earliest stage at the top and latest stage at the bottom. Sequence numbers are assigned deterministically from source chronology, using source creation time and stable source ID as the tie-breaker. Existing sequence numbers are not renumbered during ordinary updates.

For a page-based batch, public status is aggregated in this order:

1. Any active page makes the batch `processing`.
2. Otherwise any queued page makes it `queued`.
3. Otherwise, if all required pages are ready/confirmed, the batch is `completed`.
4. Otherwise, if all terminal non-success pages are cancelled, the batch is `cancelled`.
5. Otherwise any terminal failure makes the batch `failed`.

The UI shows only the translated business state (`排队中`, `处理中`, `等待补充`, `已完成`, `处理失败`, `已取消`). It does not show raw error messages, failure stages, retry counts, or internal status codes.

## Projection and write path

Migration creates the tables, constraints, indexes, policies, private functions, and triggers in one deployable unit. Source triggers enqueue no external work; they upsert only the lightweight read-model rows associated with the changed source record.

Triggers cover:

- `uat_requirement_analyses` insert/update for understanding stages.
- `uat_framework_adjustments` insert/update for framework-revision reasons.
- `uat_content_revisions` insert/update for content-revision labels, reasons, and acceptance.
- `uat_design_generations` insert/update for batch state and durable assets.

The projection uses `output.formal_asset_url` only. It inserts or updates an asset only after that field contains a valid public `designs` bucket URL. `output.image_url`, `drive_url`, `provider_url`, generation URLs, and history JSON are never candidates.

The worker remains responsible for copying successful provider output into Supabase Storage. Existing generation writers continue writing `uat_design_generations`; they do not need to duplicate every operational field into the new tables. The trigger projection keeps all current writers compatible. A narrowly scoped service-role rebuild function is also provided for backfill and repair, with no authenticated execute permission.

## Historical backfill

The migration runs an idempotent backfill for all existing tasks, including `TK-0001`:

1. Project requirement-analysis stages in chronological order.
2. Group generation rows by business source key, not by individual provider attempt.
3. Project framework and content modification reasons from their business source records.
4. Insert assets only for rows whose `formal_asset_url` passes the Storage public-URL rule.
5. Keep failed or cancelled business batches in the timeline even when they have no images.
6. Derive deterministic sequence numbers from stage chronology.

Repeated migration verification or repair calls use the source uniqueness constraint and asset ordering constraint, so they update the same business rows rather than creating duplicates.

Historical technical attempts that cannot be linked to a stable business batch remain available in `uat_design_generations` for debugging but are intentionally not exposed in the sanitized timeline.

## Security and Data API exposure

Both public tables have RLS enabled. Permissions follow the existing formal-delivery tables:

- Revoke all privileges from `anon` and `authenticated` first.
- Grant `SELECT` only to `authenticated`.
- Grant service-role access required for migration, projection repair, and backend maintenance.
- `ai_generation_runs` select policy calls `public.can_access_uat_ai_task(task_id)`.
- `ai_generation_assets` select policy checks access through its parent run and the same task-access function.
- The browser receives no insert, update, or delete grants.

Grants are explicit rather than relying on project defaults. RLS and SQL grants are both required: a policy alone does not expose a table to the Data API, and a grant alone does not authorize task rows.

## Workspace UI

The AI Designer Workspace removes the import, mount point, and component file for `seedream-drive-preview-ui-v7.js`. No `Seedream Demo`, Google Drive preview, or persistent-archive wording remains.

`all-generation-results-v1.js` is replaced or version-bumped into an AI-workspace-only renderer. It:

- Queries `ai_generation_runs` for the current task ordered by `sequence_no ASC`.
- Queries `ai_generation_assets` for returned run IDs ordered by `sort_order ASC`.
- Renders one batch card per run with title, reason, AI summary, translated state, timestamps, and its images.
- Uses only `<img src="asset.asset_url">` for image data.
- Opens the existing in-system image preview modal on click.
- Does not import Drive preview helpers or requester-page logic.

The renderer maintains explicit loading, empty, and query-error states. A query error displays a concise business message and logs only to the browser console for authorized developers; it does not fall back to `uat_design_generations`, Drive, or `history_json`.

Source guards assert that the rendered module contains none of these labels or fields: `Seedream`, `Google Drive`, `run id`, `run_id`, `prompt`, `model`, `drive_url`, `generation_url`, `provider_url`, or `history_json`.

## Deployment sequence

1. Apply the database migration and run the idempotent backfill.
2. Verify table definitions, constraints, indexes, explicit grants, RLS policies, trigger ownership, and private-function execute privileges.
3. Verify direct Data API reads as an authorized AI designer and rejection for anonymous or unrelated users.
4. Deploy the refactored workspace renderer and remove the redundant preview component/import.
5. Deploy any worker compatibility changes only if verification finds a missing `formal_asset_url` persistence path.
6. Validate existing and new flows before publishing the web bundle.

This order ensures the new read model exists and contains history before the workspace switches data sources.

## Verification

### Database

- Schema assertions cover every column, check, foreign key, uniqueness rule, and index.
- RLS tests prove authorized AI designers can read only accessible tasks.
- Permission tests prove `anon` cannot read and authenticated clients cannot write.
- Function tests prove public/authenticated users cannot execute projection or rebuild functions.
- URL tests reject Drive, provider, signed temporary, malformed, and non-`designs` URLs.
- Backfill tests prove repeat execution does not duplicate runs or assets.

### Projection

- A requirement-analysis update creates or updates exactly one no-image understanding stage.
- Multiple page rows for one framework batch create one run with ordered assets.
- Framework and content revisions populate the correct change reason.
- Mixed page states produce the specified aggregate status.
- A ready page without `formal_asset_url` creates no asset.
- Final acceptance converts the latest content batch to `final_design` without duplicating images.

### Workspace

- Timeline order is `需求理解 → 框架生成 → 框架修改 → 第1次内容修改 → 第2次内容修改 → 最终设计` when all stages exist.
- Each batch shows its images, reason, summary, and business status.
- Images load directly from `asset_url` and open in the system modal.
- No redundant Seedream/Drive preview module is mounted.
- No model, prompt, run ID, Drive link, storage detail, retry record, or raw error is visible.
- Existing generation controls, orchestration, and retry actions still work.
- `task-detail-requester.html` and its renderer remain unchanged.

### End-to-end task

For `TK-0001`, verify historical projection and then exercise a new modification batch from request through Storage persistence. The new batch must move from queued to processing to completed, add ordered public assets, and appear last in the timeline without a refresh race or duplicate card.

## Compatibility and rollback

The new tables are additive and do not replace operational writes. Older workers remain compatible because projection observes existing source records. The requester delivery tables remain independent.

If the new workspace renderer must be rolled back, the operational generation pipeline continues unchanged. The new read model can remain populated safely. Dropping it is a separate, explicit migration and is not part of routine rollback.
