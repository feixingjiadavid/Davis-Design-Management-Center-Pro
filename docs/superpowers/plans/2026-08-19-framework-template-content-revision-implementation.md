# Framework Template + Content Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved framework loop, freeze the leader-approved Demo as the only design template, let the requester either accept it directly or submit content-only revisions that stay visually anchored to that template, and guarantee that no paid Seedream request happens without an explicit user generation action.

**Architecture:** Keep `test_tasks.status` and `history_json` as the only task lifecycle, add three structured fact tables for framework adjustments, approved templates, and content revisions, and route all state-changing workflow actions through the existing UAT Edge backend. Refactor the existing Seedream queue worker into explicit generation strategies (`initial_framework`, `framework_revision`, `content_revision`) so the same Ark gateway + Google Drive archive path is reused without creating a second generation stack.

**Tech Stack:** GitHub Pages frontend, vanilla JS modules, Supabase Postgres/RLS, Supabase Edge Functions (Deno/TypeScript), existing `uat-seedream-worker`, existing `uat-ark-gateway`, Google Drive relay/archive, Node `.mjs` tests, Deno TypeScript tests.

**Spec:** `docs/superpowers/specs/2026-08-19-framework-template-content-revision-design.md`

## Global Constraints

- `test_tasks.status` remains the only task lifecycle state machine.
- Framework rejection never triggers generation automatically.
- A requester must submit non-empty `requester_direction` before a rejected framework can generate again.
- After leader approval, the approved framework is immutable and the requester has no route to change framework direction.
- Leader approval must move directly to requester `reviewing`; it must not trigger final generation.
- Direct requester acceptance after leader approval creates zero new `uat_design_generations` rows and zero Ark provider POSTs.
- Content update detection and diffing create zero provider generations.
- Only explicit requester clicks on `提交调整要求，重新生成框架` or `提交内容更新并生成新版本` may create paid generation rows.
- Every paid generation request requires an idempotency key.
- Provider-state-unknown failures must never be auto-retried.
- The existing pre-provider `safeConnectRetry` policy may remain only for errors proven to be pre-provider connection failures; no new retry path may be added.
- Approved template page count, page order, page role/title, overall visual direction, and page composition remain locked after approval.
- Unchanged pages reuse existing Google Drive files; only affected pages may generate.
- Every content revision generation must use the corresponding approved template page as the highest-priority visual anchor.
- High-resolution originals stay in Google Drive; Supabase stores only structured metadata and file IDs/URLs.
- `design-system` Supabase must not be modified.
- UAT Supabase project is `bjzfkwxrvytgphvgwltl`.
- No implementation or test step may invoke image generation unless the action is the explicit generation path under test with a mocked/fake provider.

---

## File Structure

### Database

- Create: `supabase/migrations/202608190001_framework_template_revision_flow.sql` — tables, indexes, FK columns on `uat_design_generations`, RLS, read policies, and service-only mutation model.

### Backend domain/services

- Create: `supabase/functions/uat-ai-design/framework-template-core.ts` — pure guards, framework version parsing, template page validation, fixed-page diff, manifest construction, capacity checks.
- Create: `supabase/functions/uat-ai-design/framework-template-core.test.ts` — pure lifecycle/diff tests.
- Create: `supabase/functions/uat-ai-design/framework-lifecycle-service.ts` — reject/approve/template-freeze/adjustment orchestration.
- Create: `supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts` — backend state transition tests with fake Supabase adapter.
- Create: `supabase/functions/uat-ai-design/content-revision-service.ts` — source hash preparation, fixed-schema mapping, affected-page selection, revision persistence.
- Create: `supabase/functions/uat-ai-design/content-revision-service.test.ts` — no-change, one-page-change, capacity-conflict tests.
- Create: `supabase/functions/uat-ai-design/template-revision-prompt.ts` — immutable-template Seedream prompt builder and input ordering contract.
- Create: `supabase/functions/uat-ai-design/template-revision-prompt.test.ts` — prompt and anchor-order tests.
- Modify: `supabase/functions/uat-ai-design/analysis-service.ts` — accept optional workflow context for framework adjustment/content revision while keeping first-round analysis behavior.
- Modify: `supabase/functions/uat-ai-design/requirement-prompt.ts` — include workflow context as a higher-priority bounded instruction without allowing it to reopen approved page structure.
- Modify: `supabase/functions/uat-ai-design/workflow-actions.ts` — remove any automatic-generation implication and classify source-refresh actions explicitly.
- Modify: `supabase/functions/uat-ai-design/index.ts` — add controlled workflow actions and remove legacy automatic Demo/final generation side effects.
- Modify: `supabase/functions/uat-ai-design/generation-service.ts` — expose reusable page/asset helpers only; do not use its legacy auto-final path for the new flow.

### Seedream queue worker

- Create: `supabase/functions/uat-seedream-worker/generation-strategy.mjs` — select generation mode, prompt source, inputs, completion behavior.
- Create: `supabase/functions/uat-seedream-worker/generation-strategy.test.mjs` — first framework/framework revision/content revision strategy tests.
- Modify: `supabase/functions/uat-seedream-worker/index.ts` — process queued rows by strategy, archive every generated page to Drive, complete framework or revision manifests without auto-approval.
- Modify: `supabase/functions/uat-seedream-worker/worker-policy.mjs` only if needed to make the provider-state-unknown no-retry rule explicit; do not broaden retries.

### Frontend

- Create: `js/requester-framework-revision-core.mjs` — pure requester UI state selection and button permissions.
- Create: `js/requester-framework-revision-core.test.mjs` — requester state tests.
- Create: `js/requester-framework-revision-flow-v1.js` — rejected-framework form, post-approval acceptance, Tencent/system content update UI, revision status UI.
- Modify: `js/ai-requirement-client.js` — add backend action helpers; route lifecycle mutations through Edge instead of direct task updates.
- Modify: `js/task-detail-requester.js` — stop old direct approve/reject/accept mutations from owning AI flow; delegate to the new module while retaining non-AI legacy behavior.
- Modify: `js/requester-demo-view-v12.js` — render approved template/current revision manifest instead of assuming only `kind='demo'` rows.
- Modify: `js/framework-hd-review-v1.js` — resolve the exact framework version under review rather than implicitly taking any latest Drive IDs.
- Modify: `supabase-config.js` — bootstrap the new requester flow with a new cache version.
- Modify: `task-detail-requester.html` — bump module/script cache versions once the new flow is complete.

### Migration/backfill

- Create: `supabase/migrations/202608190002_backfill_tk0001_approved_template.sql` only after the generic code is verified; it must copy existing facts and must not create generation rows.

---

### Task 1: Add Structured Framework/Revision Data Model

**Files:**
- Create: `supabase/migrations/202608190001_framework_template_revision_flow.sql`

**Interfaces:**
- Produces tables `uat_framework_adjustments`, `uat_framework_templates`, `uat_content_revisions`.
- Produces nullable FK columns `framework_adjustment_id`, `template_id`, `revision_id`, `generation_mode` on `uat_design_generations`.
- Later services rely on unique `uat_framework_templates.task_id`, unique `(task_id, revision_no)`, and service-only writes.

- [ ] **Step 1: Write the migration with tables and constraints**

```sql
create table if not exists public.uat_framework_adjustments (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  based_on_framework_version text not null,
  leader_feedback text,
  requester_direction text not null check (length(btrim(requester_direction)) > 0),
  supplemental_content text,
  refresh_tencent_doc boolean not null default false,
  created_by uuid not null,
  consumed_by_generation_run uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_framework_templates (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique references public.test_tasks(id) on delete cascade,
  framework_version text not null,
  analysis_id uuid references public.uat_requirement_analyses(id),
  approved_by uuid not null,
  approved_by_label text not null,
  approved_at timestamptz not null,
  approval_note text,
  page_count integer not null check (page_count > 0),
  width integer not null,
  height integer not null,
  source_content_hash text,
  pages jsonb not null check (jsonb_typeof(pages) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.uat_content_revisions (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  template_id uuid not null references public.uat_framework_templates(id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  source_mode text not null check (source_mode in ('tencent_doc','system_text','combined')),
  system_content text,
  previous_content_hash text,
  new_content_hash text,
  change_summary jsonb not null default '{}'::jsonb,
  affected_pages integer[] not null default '{}',
  page_manifest jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft','content_ready','generation_requested','generating','ready_for_review','capacity_conflict','failed','accepted')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  generated_at timestamptz,
  unique(task_id, revision_no)
);

alter table public.uat_design_generations add column if not exists framework_adjustment_id uuid references public.uat_framework_adjustments(id);
alter table public.uat_design_generations add column if not exists template_id uuid references public.uat_framework_templates(id);
alter table public.uat_design_generations add column if not exists revision_id uuid references public.uat_content_revisions(id);
alter table public.uat_design_generations add column if not exists generation_mode text;
```

- [ ] **Step 2: Add indexes and RLS**

```sql
create index if not exists idx_uat_framework_adjustments_task_created on public.uat_framework_adjustments(task_id, created_at desc);
create index if not exists idx_uat_content_revisions_task_revision on public.uat_content_revisions(task_id, revision_no desc);
create index if not exists idx_uat_design_generations_revision on public.uat_design_generations(revision_id, page_index);

alter table public.uat_framework_adjustments enable row level security;
alter table public.uat_framework_templates enable row level security;
alter table public.uat_content_revisions enable row level security;

create policy "uat_authenticated_read_framework_adjustments" on public.uat_framework_adjustments
  for select to authenticated using (true);
create policy "uat_authenticated_read_framework_templates" on public.uat_framework_templates
  for select to authenticated using (true);
create policy "uat_authenticated_read_content_revisions" on public.uat_content_revisions
  for select to authenticated using (true);
```

Do not add client-side insert/update/delete policies; all mutations go through service-role Edge actions that verify actor role and task ownership.

- [ ] **Step 3: Apply only to UAT and verify schema**

Apply migration to Supabase project `bjzfkwxrvytgphvgwltl`, then run:

```sql
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('uat_framework_adjustments','uat_framework_templates','uat_content_revisions')
order by table_name;

select column_name
from information_schema.columns
where table_schema='public'
  and table_name='uat_design_generations'
  and column_name in ('framework_adjustment_id','template_id','revision_id','generation_mode')
order by column_name;
```

Expected: 3 table rows and 4 generation-column rows. Verify no changes were made to project `supffjeeouibhqdfqosk`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202608190001_framework_template_revision_flow.sql
git commit -m "feat: add framework template revision data model"
```

---

### Task 2: Add Pure Lifecycle, Fixed-Schema Diff, and Manifest Core

**Files:**
- Create: `supabase/functions/uat-ai-design/framework-template-core.ts`
- Create: `supabase/functions/uat-ai-design/framework-template-core.test.ts`

**Interfaces:**
- Produces `latestFormalAction(history)`, `assertFrameworkCanBeRejected(task, history)`, `assertFrameworkCanBeApproved(task, history)`, `validateTemplatePages(pages)`, `diffFixedTemplatePages(templatePages, nextPages)`, `buildRevisionManifest(templatePages, previousManifest, generatedPages)`, `classifyCapacityConflict(templatePages, nextPages)`.
- Used by framework lifecycle, content revision service, and worker completion logic.

- [ ] **Step 1: Write failing tests for framework guards**

```ts
import { assertEquals, assertThrows } from "jsr:@std/assert";
import { assertFrameworkCanBeApproved, assertFrameworkCanBeRejected } from "./framework-template-core.ts";

Deno.test("leader may reject only pending_approval framework", () => {
  assertFrameworkCanBeRejected({ status: "pending_approval" }, [{ action: "submit_framework", version: "v-2" }]);
  assertThrows(() => assertFrameworkCanBeRejected({ status: "processing" }, [{ action: "submit_framework", version: "v-2" }]));
});

Deno.test("leader may approve only pending_approval framework", () => {
  assertFrameworkCanBeApproved({ status: "pending_approval" }, [{ action: "submit_framework", version: "v-3" }]);
  assertThrows(() => assertFrameworkCanBeApproved({ status: "rejected" }, [{ action: "reject_framework", version: "v-3" }]));
});
```

- [ ] **Step 2: Write failing tests for locked page schema**

```ts
import { assertEquals } from "jsr:@std/assert";
import { diffFixedTemplatePages } from "./framework-template-core.ts";

Deno.test("only changed P2 is affected", () => {
  const template = [
    { page_index: 1, page_title: "封面页", exact_copy: ["A"] },
    { page_index: 2, page_title: "规则页", exact_copy: ["B"] },
    { page_index: 3, page_title: "补充页", exact_copy: ["C"] },
  ];
  const next = [
    { index: 1, title: "封面页", copy: ["A"] },
    { index: 2, title: "规则页", copy: ["B2"] },
    { index: 3, title: "补充页", copy: ["C"] },
  ];
  assertEquals(diffFixedTemplatePages(template, next).affectedPages, [2]);
});

Deno.test("page role change is a capacity conflict", () => {
  const template = [{ page_index: 1, page_title: "封面页", exact_copy: ["A"] }];
  const next = [{ index: 1, title: "规则页", copy: ["A"] }];
  assertEquals(diffFixedTemplatePages(template, next).capacityConflict, true);
});
```

- [ ] **Step 3: Run tests and confirm they fail before implementation**

Run:

```bash
deno test supabase/functions/uat-ai-design/framework-template-core.test.ts
```

Expected: FAIL because the module/functions do not exist yet.

- [ ] **Step 4: Implement normalization and diff**

```ts
const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export function diffFixedTemplatePages(templatePages: any[], nextPages: any[]) {
  if (templatePages.length !== nextPages.length) return { affectedPages: [], capacityConflict: true, reason: "PAGE_COUNT_CHANGED" };
  const affectedPages: number[] = [];
  for (let offset = 0; offset < templatePages.length; offset += 1) {
    const template = templatePages[offset];
    const next = nextPages[offset];
    if (Number(template.page_index) !== Number(next.index) || normalize(template.page_title) !== normalize(next.title)) {
      return { affectedPages: [], capacityConflict: true, reason: "PAGE_ROLE_CHANGED" };
    }
    const before = (template.exact_copy || []).map(normalize);
    const after = (next.copy || []).map(normalize);
    if (JSON.stringify(before) !== JSON.stringify(after)) affectedPages.push(Number(template.page_index));
  }
  return { affectedPages, capacityConflict: false, reason: null };
}
```

- [ ] **Step 5: Implement guards and manifest construction**

`assertFrameworkCanBeApproved/Rejected` must require `task.status === 'pending_approval'` and latest formal submission to be `submit_framework`. `buildRevisionManifest` must prefer newly generated page rows, otherwise the previous revision page, otherwise the immutable template page.

- [ ] **Step 6: Run tests**

```bash
deno test supabase/functions/uat-ai-design/framework-template-core.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/uat-ai-design/framework-template-core.ts supabase/functions/uat-ai-design/framework-template-core.test.ts
git commit -m "feat: add framework template lifecycle core"
```

---

### Task 3: Move Leader Reject/Approve to Controlled Backend and Freeze Approved Template

**Files:**
- Create: `supabase/functions/uat-ai-design/framework-lifecycle-service.ts`
- Create: `supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts`
- Modify: `supabase/functions/uat-ai-design/index.ts`
- Modify: `js/ai-requirement-client.js`
- Modify: `js/task-detail-requester.js`

**Interfaces:**
- Produces backend actions `reject_framework` and `approve_framework`.
- `approve_framework` creates the immutable `uat_framework_templates` row and sets task to `reviewing` without generation.
- `reject_framework` sets task to `rejected` and records history only.

- [ ] **Step 1: Write failing service tests**

Test cases must assert:

```ts
Deno.test("reject framework writes history and performs zero generation inserts", async () => {
  const result = await rejectFramework(fakeAdmin, "TK-0001", leaderActor, "方向不合适");
  assertEquals(result.status, "rejected");
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});

Deno.test("approve framework freezes exact submitted pages and performs zero generation inserts", async () => {
  const result = await approveFramework(fakeAdmin, "TK-0001", leaderActor, "确认方向无误");
  assertEquals(result.status, "reviewing");
  assertEquals(result.template.pages.map((page: any) => page.page_index), [1, 2, 3]);
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});
```

- [ ] **Step 2: Run tests to verify red state**

```bash
deno test supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement `rejectFramework`**

The service must:

```ts
assertFrameworkCanBeRejected(task, history);
history.push({
  action: "reject_framework",
  version: submitted.version,
  reply: reason.trim(),
  operator: actor.label,
  reply_by: actor.label,
  is_rejected: true,
  time: new Date().toISOString(),
});
await admin.from("test_tasks").update({
  status: "rejected",
  summary_desc: `领导驳回框架：${reason.trim()}`,
  history_json: JSON.stringify(history),
}).eq("id", taskId);
```

It must not call generation code.

- [ ] **Step 4: Implement `approveFramework`**

Use the `ai_demo_generation_ids` and `drive_file_ids` from the exact submitted framework history item. Load those generation rows, sort by `page_index`, validate all are ready/confirmed and all have Drive file IDs, then insert exactly one template row:

```ts
const pages = generations.map((row: any) => ({
  page_index: Number(row.page_index),
  page_title: String(row.output?.page_title || `P${row.page_index}`),
  generation_id: row.id,
  drive_file_id: String(row.output?.drive_file_id),
  drive_url: String(row.output?.drive_url || row.output?.image_url || ""),
  exact_copy: Array.isArray(row.output?.exact_copy) ? row.output.exact_copy.map(String) : [],
}));
```

Then set task to `reviewing`, append `approve_framework`, and do not call `generate_final`.

- [ ] **Step 5: Add Edge action authorization**

In `index.ts`, allow `uat.leader@webank.com` only for `approve_framework`/`reject_framework`, and allow the requester only for requester actions. The new actions must call lifecycle service functions and return JSON.

- [ ] **Step 6: Route leader UI through Edge**

Add to `ai-requirement-client.js`:

```js
export async function approveFramework(supabase, taskId, note = '') {
  return invokeAiAction(supabase, taskId, 'approve_framework', { note });
}

export async function rejectFramework(supabase, taskId, reason) {
  return invokeAiAction(supabase, taskId, 'reject_framework', { reason });
}
```

Replace `window.submitApprove` and leader-side `window.submitReject` direct `updateSupabaseState(...)` calls with these helpers. On success reload once; do not queue generation.

- [ ] **Step 7: Run backend tests and static frontend checks**

```bash
deno test supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts
node --check js/ai-requirement-client.js
node --check js/task-detail-requester.js
```

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/uat-ai-design/framework-lifecycle-service.ts supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts supabase/functions/uat-ai-design/index.ts js/ai-requirement-client.js js/task-detail-requester.js
git commit -m "feat: freeze leader approved framework template"
```

---

### Task 4: Add Rejected-Framework Adjustment Gate and Manual Framework Regeneration

**Files:**
- Modify: `supabase/functions/uat-ai-design/analysis-service.ts`
- Modify: `supabase/functions/uat-ai-design/requirement-prompt.ts`
- Modify: `supabase/functions/uat-ai-design/index.ts`
- Modify: `supabase/functions/uat-ai-design/workflow-actions.ts`
- Create: `supabase/functions/uat-ai-design/framework-adjustment.test.ts`

**Interfaces:**
- Produces `generate_framework_revision` action.
- Consumes a non-empty `requester_direction`, optional refreshed Tencent document, optional supplemental content, and an idempotency key.
- Queues a new framework run only after persisting the adjustment.

- [ ] **Step 1: Write failing tests for generation gate**

```ts
Deno.test("framework revision rejects empty requester direction", async () => {
  await assertRejects(
    () => prepareFrameworkRevision(fakeAdmin, "TK-0001", requesterActor, { requester_direction: "", idempotency_key: "k1" }),
    Error,
    "REQUESTER_DIRECTION_REQUIRED",
  );
});

Deno.test("rejected framework does not generate before requester submit", async () => {
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});
```

- [ ] **Step 2: Extend analysis workflow context**

Change signature:

```ts
export type AnalysisWorkflowContext = {
  frameworkAdjustment?: {
    leaderFeedback: string;
    requesterDirection: string;
    supplementalContent: string;
  };
  lockedPageSchema?: Array<{ index: number; title: string }>;
};

export async function analyzeRequirement(admin: any, task: Record<string, any>, userJwt: string, context: AnalysisWorkflowContext = {})
```

Pass `workflow_context: context` into `buildRequirementPrompt`.

- [ ] **Step 3: Add prompt rule for framework adjustment**

In `requirement-prompt.ts`, when `task.workflow_context.frameworkAdjustment` exists, include a bounded block before source text:

```text
FRAMEWORK_ADJUSTMENT_BEGIN
领导原始意见：<leaderFeedback>
需求方与领导沟通后的执行要求：<requesterDirection>
需求方补充内容：<supplementalContent>
FRAMEWORK_ADJUSTMENT_END
```

State that `requesterDirection` is the executable direction for the next framework round, while source facts/copy still come from validated sources.

- [ ] **Step 4: Implement `generate_framework_revision` action**

Required order:

```ts
assert task.status === "rejected";
assert latest formal action is "reject_framework";
assert requester_direction.trim().length > 0;
assert idempotency_key.trim().length > 0;
insert uat_framework_adjustments;
optionally refresh sources;
analyze requirement with frameworkAdjustment context;
confirm the new analysis only if it is understanding_ready and no open clarifications;
queue one `uat_design_generations` row per fixed page with generation_mode="framework_revision" and framework_adjustment_id=<id>;
append framework_adjustment_submitted history;
set task.status="processing";
```

If analysis still needs clarification, do not queue generation; set task to `needs_input` and preserve the adjustment.

- [ ] **Step 5: Remove old auto-generation side effects**

In `index.ts`:

- `executeAnalysis()` must stop after analysis/clarification state updates.
- `confirm_understanding` must only confirm; it must not call `runDemoGeneration`.
- `auto_analyze`, clarification answers, or source refresh must never create generation rows.
- Initial framework generation remains an explicit separate `generate_demo` action from the AI designer workspace.

- [ ] **Step 6: Run tests**

```bash
deno test supabase/functions/uat-ai-design/framework-adjustment.test.ts supabase/functions/uat-ai-design/analysis-service.test.ts
```

Expected: PASS and no provider function used in tests.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/uat-ai-design/analysis-service.ts supabase/functions/uat-ai-design/requirement-prompt.ts supabase/functions/uat-ai-design/index.ts supabase/functions/uat-ai-design/workflow-actions.ts supabase/functions/uat-ai-design/framework-adjustment.test.ts
git commit -m "feat: gate framework regeneration on requester direction"
```

---

### Task 5: Add Content Update Detection, Fixed-Schema Preparation, and Capacity Guard

**Files:**
- Create: `supabase/functions/uat-ai-design/content-revision-service.ts`
- Create: `supabase/functions/uat-ai-design/content-revision-service.test.ts`
- Modify: `supabase/functions/uat-ai-design/index.ts`

**Interfaces:**
- Produces `check_content_update`, `prepare_content_revision`, and persistence of `uat_content_revisions`.
- `prepare_content_revision` returns either `content_ready`, `capacity_conflict`, or `no_change` and never generates.

- [ ] **Step 1: Write failing tests for no-change and one-page change**

```ts
Deno.test("no content change produces zero affected pages", async () => {
  const result = await prepareRevision(fakeAdmin, inputWithSameCopy);
  assertEquals(result.kind, "no_change");
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});

Deno.test("P2 content change marks only P2 affected", async () => {
  const result = await prepareRevision(fakeAdmin, inputWithP2Changed);
  assertEquals(result.affected_pages, [2]);
  assertEquals(result.status, "content_ready");
});

Deno.test("page count change is capacity conflict", async () => {
  const result = await prepareRevision(fakeAdmin, inputWithExtraPage);
  assertEquals(result.status, "capacity_conflict");
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});
```

- [ ] **Step 2: Implement source hash helpers**

Use Web Crypto SHA-256 for system text and deterministic combined hashes:

```ts
export async function sha256Text(text: string) {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, "\n").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 3: Implement `check_content_update`**

It may call `ingestTaskSources`, then compare the current Tencent snapshot hash against template/current-revision source hash. Return hashes and `changed: boolean`. Do not create `uat_design_generations`.

- [ ] **Step 4: Implement `prepare_content_revision`**

It must:

1. Load immutable template and latest accepted/ready revision.
2. Build source mode `tencent_doc | system_text | combined`.
3. Analyze updated content with `lockedPageSchema` equal to template page index/title list.
4. Call `diffFixedTemplatePages`.
5. Insert one `uat_content_revisions` row with `content_ready`, `capacity_conflict`, or a no-change result.
6. Never queue generation.

- [ ] **Step 5: Add Edge routes**

`check_content_update` and `prepare_content_revision` must be requester-authorized and return 200/202 without provider calls.

- [ ] **Step 6: Run tests**

```bash
deno test supabase/functions/uat-ai-design/content-revision-service.test.ts supabase/functions/uat-ai-design/framework-template-core.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/uat-ai-design/content-revision-service.ts supabase/functions/uat-ai-design/content-revision-service.test.ts supabase/functions/uat-ai-design/index.ts
git commit -m "feat: prepare template locked content revisions"
```

---

### Task 6: Refactor Seedream Worker into Explicit Generation Strategies

**Files:**
- Create: `supabase/functions/uat-seedream-worker/generation-strategy.mjs`
- Create: `supabase/functions/uat-seedream-worker/generation-strategy.test.mjs`
- Create: `supabase/functions/uat-ai-design/template-revision-prompt.ts`
- Create: `supabase/functions/uat-ai-design/template-revision-prompt.test.ts`
- Modify: `supabase/functions/uat-seedream-worker/index.ts`

**Interfaces:**
- Produces strategy objects for `initial_framework`, `framework_revision`, and `content_revision`.
- Content revision strategy consumes immutable template page Drive image as input index 0 and never substitutes a previous revision as the visual authority.

- [ ] **Step 1: Write failing strategy tests**

```js
import assert from 'node:assert/strict';
import { resolveGenerationStrategy } from './generation-strategy.mjs';

const templatePage = { drive_preview_data_url: 'data:image/jpeg;base64,TEMPLATE', page_index: 2 };
const row = { generation_mode: 'content_revision', page_index: 2, output: {} };
const strategy = resolveGenerationStrategy({ row, templatePage, styleReferences: [], assets: [] });
assert.equal(strategy.mode, 'content_revision');
assert.equal(strategy.images[0], templatePage.drive_preview_data_url);
assert.equal(strategy.allowAutomaticProviderRetry, false);
```

- [ ] **Step 2: Write prompt tests**

```ts
Deno.test("template revision prompt forbids redesign", () => {
  const prompt = buildTemplateRevisionPrompt({
    templatePageTitle: "规则页",
    exactCopy: ["新规则"],
    changeSummary: ["奖励数字发生变化"],
  });
  assertStringIncludes(prompt, "不可变视觉母版");
  assertStringIncludes(prompt, "禁止重新设计");
  assertFalse(prompt.includes("重新形成视觉概念"));
});
```

- [ ] **Step 3: Implement `buildTemplateRevisionPrompt`**

Prompt must contain the immutable-template rules from the spec and the exact new page copy. It must never use the Creative Director language that asks the model to invent a new concept.

- [ ] **Step 4: Implement strategy selection**

`resolveGenerationStrategy` must return:

```js
{
  mode: 'initial_framework' | 'framework_revision' | 'content_revision',
  prompt,
  images,
  completionTarget: 'pending_approval' | 'reviewing',
  allowAutomaticProviderRetry: false,
}
```

For `content_revision`, `images[0]` is the approved template page image; assets follow; style references come after the template and never replace it.

- [ ] **Step 5: Refactor worker query and page ordering**

Worker must scan queued rows whose `generation_mode` is one of the three supported modes. Prior-page gating must be scoped to the same run: same `analysis_id + framework_adjustment_id` for framework runs or same `revision_id` for content revisions.

- [ ] **Step 6: Preserve strict provider-state safety**

When fetch to gateway throws or state is unknown:

```ts
return await finishFailure(admin, candidate, `WORKER_GATEWAY_STATE_UNKNOWN:${message}`, 'worker_gateway', { provider_state_unknown: true });
```

Do not requeue. Only the existing proven pre-provider `isSafeConnectFailure` path may use `safeConnectRetry`, and tests must confirm it never runs when `provider_state_unknown === true`.

- [ ] **Step 7: Complete framework revision runs**

When all pages for a framework revision are ready, append a new `submit_framework` history item with the new version and generated Drive IDs, then task → `pending_approval`. Do not auto-approve.

- [ ] **Step 8: Complete content revision runs**

When all affected pages are ready:

1. Build a complete `page_manifest` using template/previous revision reuse plus new pages.
2. Set revision `ready_for_review` and `generated_at`.
3. Append `submit_draft` history with `revision_no` and manifest.
4. Set task → `reviewing`.
5. Do not notify leader or enter `pending_approval`.

- [ ] **Step 9: Run worker tests**

```bash
node supabase/functions/uat-seedream-worker/generation-strategy.test.mjs
deno test supabase/functions/uat-ai-design/template-revision-prompt.test.ts
node --check supabase/functions/uat-seedream-worker/index.ts
```

Expected: all pass/exit 0.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/uat-seedream-worker/generation-strategy.mjs supabase/functions/uat-seedream-worker/generation-strategy.test.mjs supabase/functions/uat-ai-design/template-revision-prompt.ts supabase/functions/uat-ai-design/template-revision-prompt.test.ts supabase/functions/uat-seedream-worker/index.ts
git commit -m "feat: add template locked Seedream generation strategies"
```

---

### Task 7: Add Explicit `generate_content_revision` and `accept_current_revision` Backend Actions

**Files:**
- Modify: `supabase/functions/uat-ai-design/content-revision-service.ts`
- Modify: `supabase/functions/uat-ai-design/index.ts`
- Modify: `js/ai-requirement-client.js`

**Interfaces:**
- Produces `generate_content_revision(revision_id, idempotency_key)` and `accept_current_revision()`.
- Generation action only queues affected pages; acceptance creates no generation rows.

- [ ] **Step 1: Write failing tests for paid-generation gate**

```ts
Deno.test("content revision generation requires explicit idempotency key", async () => {
  await assertRejects(() => queueContentRevision(fakeAdmin, "revision-1", ""), Error, "IDEMPOTENCY_KEY_REQUIRED");
});

Deno.test("content revision queues only affected P2", async () => {
  const rows = await queueContentRevision(fakeAdmin, "revision-1", "key-1");
  assertEquals(rows.map((row: any) => row.page_index), [2]);
});

Deno.test("accept current revision creates zero generation rows", async () => {
  await acceptCurrentRevision(fakeAdmin, "TK-0001", requesterActor);
  assertEquals(fakeAdmin.countInserts("uat_design_generations"), 0);
});
```

- [ ] **Step 2: Implement queueing**

For each `affected_pages` entry, insert one row with:

```ts
{
  task_id: revision.task_id,
  analysis_id: revisionAnalysis.id,
  kind: "final",
  generation_mode: "content_revision",
  template_id: revision.template_id,
  revision_id: revision.id,
  page_index,
  page_count: template.page_count,
  model: SEEDREAM_MODEL,
  prompt_version: "seedream-template-revision-v1",
  idempotency_key: `${idempotencyKey}:p${page_index}`,
  status: "queued",
}
```

Set revision → `generating` and task → `processing` only after rows are successfully inserted.

- [ ] **Step 3: Implement acceptance**

`accept_current_revision` must accept either:

- the immutable approved template when no content revision exists, or
- the latest `ready_for_review` content revision.

It sets task `completed`, marks latest revision `accepted` if present, and appends `complete` history. It must not call generation service/worker.

- [ ] **Step 4: Add client helpers**

```js
export async function checkContentUpdate(supabase, taskId) {
  return invokeAiAction(supabase, taskId, 'check_content_update');
}

export async function prepareContentRevision(supabase, taskId, payload) {
  return invokeAiAction(supabase, taskId, 'prepare_content_revision', payload);
}

export async function generateContentRevision(supabase, taskId, revisionId) {
  return invokeAiAction(supabase, taskId, 'generate_content_revision', {
    revision_id: revisionId,
    idempotency_key: newIdempotencyKey(),
  });
}

export async function acceptCurrentRevision(supabase, taskId) {
  return invokeAiAction(supabase, taskId, 'accept_current_revision');
}
```

- [ ] **Step 5: Run tests**

```bash
deno test supabase/functions/uat-ai-design/content-revision-service.test.ts
node --check js/ai-requirement-client.js
```

Expected: PASS / exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uat-ai-design/content-revision-service.ts supabase/functions/uat-ai-design/index.ts js/ai-requirement-client.js
git commit -m "feat: add explicit content revision generation and acceptance"
```

---

### Task 8: Build Requester UI for Rejected Frameworks and Post-Approval Content Revisions

**Files:**
- Create: `js/requester-framework-revision-core.mjs`
- Create: `js/requester-framework-revision-core.test.mjs`
- Create: `js/requester-framework-revision-flow-v1.js`
- Modify: `js/requester-demo-view-v12.js`
- Modify: `js/task-detail-requester.js`
- Modify: `supabase-config.js`
- Modify: `task-detail-requester.html`

**Interfaces:**
- Produces `selectRequesterFlowState({task, template, revisions, history})`.
- UI states: `framework_rejected_waiting_requester`, `template_review`, `content_revision_draft`, `content_revision_generating`, `content_revision_review`, `capacity_conflict`, `completed`.

- [ ] **Step 1: Write failing requester state tests**

```js
import assert from 'node:assert/strict';
import { selectRequesterFlowState } from './requester-framework-revision-core.mjs';

assert.equal(selectRequesterFlowState({
  task: { status: 'rejected' },
  template: null,
  revisions: [],
  history: [{ action: 'reject_framework', reply: '方向不合适' }],
}).kind, 'framework_rejected_waiting_requester');

assert.equal(selectRequesterFlowState({
  task: { status: 'reviewing' },
  template: { id: 't1' },
  revisions: [],
  history: [{ action: 'approve_framework' }],
}).kind, 'template_review');
```

- [ ] **Step 2: Run test red**

```bash
node js/requester-framework-revision-core.test.mjs
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pure state selector**

Rules:

```js
if (task.status === 'completed') return { kind: 'completed' };
if (task.status === 'rejected' && latestAction === 'reject_framework') return { kind: 'framework_rejected_waiting_requester' };
if (template && latestRevision?.status === 'capacity_conflict') return { kind: 'capacity_conflict', revision: latestRevision };
if (template && ['generation_requested','generating'].includes(latestRevision?.status)) return { kind: 'content_revision_generating', revision: latestRevision };
if (template && task.status === 'reviewing') return { kind: latestRevision?.status === 'ready_for_review' ? 'content_revision_review' : 'template_review' };
return { kind: 'passive' };
```

- [ ] **Step 4: Implement rejected-framework card**

The requester sees:

- leader feedback;
- required textarea `本轮框架调整要求`;
- checkbox `重新读取腾讯文档`;
- optional `补充文字信息` textarea;
- button `提交调整要求，重新生成框架`.

Button handler calls `generate_framework_revision` once with a fresh idempotency key. Disable it after first click until response/error; do not auto-retry.

- [ ] **Step 5: Implement approved-template review card**

When template exists and no ready revision:

- primary button `确认验收并完结` → `accept_current_revision`;
- secondary button `内容需要调整` → expands content update panel;
- no “换风格/重新设计/大改方向” control exists anywhere.

- [ ] **Step 6: Implement two content update inputs**

Tencent path:

- `检测腾讯文档最新内容` → `check_content_update`;
- render changed/not-changed copy;
- never call generation.

System text path:

- textarea `本轮需要调整的内容`;
- choose source mode based on Tencent changed flag and text presence;
- first call `prepare_content_revision`;
- if `capacity_conflict`, show the spec message and no generation button;
- if `content_ready`, show affected pages and button `提交内容更新并生成新版本`;
- only that final button calls `generate_content_revision`.

- [ ] **Step 7: Render current full page manifest**

Update `requester-demo-view-v12.js` to load template + latest revision. Resolve each page from `page_manifest`; use the existing Drive preview relay and object URL cache. The requester always sees a complete P1/P2/P3 set regardless of whether a page came from template or revision.

- [ ] **Step 8: Neutralize old AI-flow controls**

In `task-detail-requester.js`, old `reviewing` acceptance/reject controls must not show for AI-assigned tasks when the new template flow is active. Keep legacy behavior for non-AI tasks.

- [ ] **Step 9: Bootstrap and cache-bust**

Add to `supabase-config.js` under requester page:

```js
import('./js/requester-framework-revision-flow-v1.js?v=requester-template-revision-v1')
  .then(module => module.bootstrapRequesterFrameworkRevisionFlowV1(supabase))
  .catch(error => console.error('需求方母版/内容改版流程加载失败:', error));
```

Bump `task-detail-requester.html` imports from `requester-drive-preview-v10` to `requester-template-revision-v1` so GitHub Pages does not serve stale workflow JS.

- [ ] **Step 10: Run frontend tests/checks**

```bash
node js/requester-framework-revision-core.test.mjs
node --check js/requester-framework-revision-flow-v1.js
node --check js/requester-demo-view-v12.js
node --check js/task-detail-requester.js
node --check supabase-config.js
```

Expected: all exit 0.

- [ ] **Step 11: Commit**

```bash
git add js/requester-framework-revision-core.mjs js/requester-framework-revision-core.test.mjs js/requester-framework-revision-flow-v1.js js/requester-demo-view-v12.js js/task-detail-requester.js supabase-config.js task-detail-requester.html
git commit -m "feat: add requester template and content revision workflow"
```

---

### Task 9: Make Framework Review Version-Exact and Preserve Three-Page HD Approval

**Files:**
- Modify: `js/framework-hd-review-v1.js`
- Create: `js/framework-hd-review-core.test.mjs` if current tests do not already cover version-exact page selection.

**Interfaces:**
- The HD review overlay receives the exact `submit_framework` version currently in `pending_approval`.
- It must never accidentally show an older/rejected framework or a content revision.

- [ ] **Step 1: Add failing selection test**

Create history with `submit_framework v1`, `reject_framework v1`, `framework_adjustment_submitted`, `submit_framework v2`. Assert selector returns only v2 Drive IDs.

- [ ] **Step 2: Implement exact pending version selection**

Use latest formal `submit_framework` after the most recent framework adjustment/rejection cycle. Do not select by generic latest Drive record.

- [ ] **Step 3: Preserve current approval display contract**

Default overlay remains:

- P1/P2/P3 complete on one screen;
- `object-fit: contain`;
- clicking a page shows single-page complete fit;
- only explicit `1:1 看细节` allows scrolling.

- [ ] **Step 4: Run tests/check**

```bash
node js/framework-hd-review-core.test.mjs
node --check js/framework-hd-review-v1.js
```

Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add js/framework-hd-review-v1.js js/framework-hd-review-core.test.mjs
git commit -m "fix: bind leader HD review to exact framework version"
```

---

### Task 10: Backfill TK-0001 Without Any Generation

**Files:**
- Create: `supabase/migrations/202608190002_backfill_tk0001_approved_template.sql`

**Interfaces:**
- Converts current approved framework v-1 facts into one `uat_framework_templates` row.
- Sets TK-0001 to `reviewing`.
- Does not alter existing Drive originals or create new generation rows.

- [ ] **Step 1: Record baseline generation count before migration**

Run against UAT:

```sql
select count(*) as generation_count
from public.uat_design_generations
where task_id='TK-0001';
```

Expected current count: 5 rows (3 ready, 1 failed, 1 cancelled) unless a later explicit user generation has occurred. If count differs, stop and inspect before backfill.

- [ ] **Step 2: Write idempotent backfill migration**

The migration must select the current `submit_framework` v-1 history metadata and the three existing ready generation IDs:

```text
c25b160f-267c-4275-a0b2-8fd620a31c01
c10611ea-fa4f-4241-9693-bfe5cadfbd4f
e91db21d-cf43-4c01-9ad1-8a69859f17b6
```

Insert template only when `uat_framework_templates.task_id='TK-0001'` does not already exist. Build `pages` from live generation rows so Drive IDs and exact copy are taken from the database rather than duplicated constants. Set task status to `reviewing` and summary to `领导框架已通过，等待需求方验收或提交内容更新`.

- [ ] **Step 3: Apply migration and verify zero new generation rows**

Run:

```sql
select task_id, framework_version, page_count, pages
from public.uat_framework_templates
where task_id='TK-0001';

select status, summary_desc
from public.test_tasks
where id='TK-0001';

select count(*) as generation_count
from public.uat_design_generations
where task_id='TK-0001';
```

Expected: one template row, task `reviewing`, generation count unchanged from Step 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202608190002_backfill_tk0001_approved_template.sql
git commit -m "migrate: freeze TK-0001 approved framework without regeneration"
```

---

### Task 11: Deploy UAT Edge Functions and Run End-to-End Safety Verification

**Files:**
- No new product files unless verification exposes a defect.

**Interfaces:**
- Deploys only to `bjzfkwxrvytgphvgwltl`.
- Confirms the user-visible workflow and the provider-call safety contract.

- [ ] **Step 1: Run complete local test suite for touched modules**

```bash
deno test supabase/functions/uat-ai-design/framework-template-core.test.ts \
  supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts \
  supabase/functions/uat-ai-design/framework-adjustment.test.ts \
  supabase/functions/uat-ai-design/content-revision-service.test.ts \
  supabase/functions/uat-ai-design/template-revision-prompt.test.ts

node supabase/functions/uat-seedream-worker/generation-strategy.test.mjs
node js/requester-framework-revision-core.test.mjs
node js/framework-hd-review-core.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Deploy `uat-ai-design` and `uat-seedream-worker` from the verified commit**

Deploy only to UAT `bjzfkwxrvytgphvgwltl`. Do not deploy or edit functions in `supffjeeouibhqdfqosk`.

- [ ] **Step 3: Verify no automatic generation on safe actions**

Before each action, record generation count; after each action verify unchanged:

- `reject_framework`
- `check_content_update`
- `prepare_content_revision` with no change
- `prepare_content_revision` causing `capacity_conflict`
- `accept_current_revision`

Also query recent `uat_audit_log` and verify no `demo_generation_started`, `final_generated`, or Ark generation audit entry exists for these actions.

- [ ] **Step 4: Verify rejected-framework UX without generating**

Use a disposable UAT task or a controlled test fixture:

1. Put framework into `pending_approval` with Drive-backed pages.
2. Leader rejects it.
3. Requester sees leader feedback + required adjustment form.
4. Confirm generation count remains unchanged until requester clicks `提交调整要求，重新生成框架`.

Do not click the paid generation button during this verification unless the user explicitly authorizes a real paid UAT generation.

- [ ] **Step 5: Verify TK-0001 post-approval UX**

For TK-0001 requester page:

- page is stable with no 2-second full-page flashing;
- status is requester review, not leader approval;
- P1/P2/P3 current full set loads from Drive;
- buttons are exactly `确认验收并完结` and `内容需要调整`;
- no framework/style-change control exists;
- clicking Tencent update detection does not create generation rows;
- do not click any paid generation button unless user explicitly authorizes it.

- [ ] **Step 6: Verify direct acceptance is zero-generation**

On a disposable cloned UAT fixture, call `accept_current_revision`; verify task becomes `completed`, history contains `complete`, and generation count is unchanged. Do not complete TK-0001 unless the user explicitly wants to close that live UAT task.

- [ ] **Step 7: Verify partial-generation recovery logic with mocks, not provider**

Use worker strategy tests/fake gateway to simulate P2 ready and P3 failed. Verify successful pages remain recorded, revision does not become `reviewing`, and no automatic retry occurs when provider state is unknown.

- [ ] **Step 8: Final code/status verification**

Check GitHub `main` contains the migration, services, worker strategy, requester flow, cache bust, and tests. Query UAT to confirm:

```sql
select id,status,summary_desc from public.test_tasks where id='TK-0001';
select task_id,framework_version,page_count from public.uat_framework_templates where task_id='TK-0001';
select count(*) from public.uat_design_generations where task_id='TK-0001';
```

Report the exact test counts, deployed function versions, and generation count before/after. Do not claim completion without these fresh results.
