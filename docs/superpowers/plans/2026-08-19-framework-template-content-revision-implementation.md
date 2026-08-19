# Framework Template + Content Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a framework loop where leader rejection returns to the requester for clarified direction, leader approval freezes the approved Demo as the only design template, and all later content-only revisions remain anchored to that template with explicit paid-generation gates.

**Architecture:** Keep `test_tasks.status` + `history_json` as the only task lifecycle. Add structured fact tables for framework adjustments, approved templates, and content revisions; move framework approval/rejection and revision actions into the existing UAT Edge backend; refactor the existing Seedream queue worker into explicit generation strategies while reusing the same Ark gateway and Google Drive archive path.

**Tech Stack:** GitHub Pages + vanilla JS modules, Supabase Postgres/RLS, Supabase Edge Functions (Deno/TypeScript), existing `uat-seedream-worker`, existing `uat-ark-gateway`, Google Drive archive/preview relay, Deno tests, Node `.mjs` tests.

**Spec:** `docs/superpowers/specs/2026-08-19-framework-template-content-revision-design.md`

## Global Constraints

- UAT project only: `bjzfkwxrvytgphvgwltl`.
- Do not modify `design-system` project `supffjeeouibhqdfqosk`.
- `test_tasks.status` remains the only task lifecycle state.
- Leader rejection creates zero generation rows and zero provider POSTs.
- Rejected framework regeneration requires non-empty `requester_direction` and one explicit requester click.
- Leader approval creates the immutable template and moves directly to `reviewing`; it must not generate a final image.
- Direct requester acceptance creates zero generation rows and zero provider POSTs.
- Tencent document checking, system-text saving, hash comparison, fixed-page diffing, and capacity conflict create zero provider POSTs.
- Only `提交调整要求，重新生成框架` and `提交内容更新并生成新版本` may create paid generation rows.
- Every paid generation request requires an idempotency key.
- Provider-state-unknown failures are terminal for that generation row; no automatic paid retry.
- Existing pre-provider `safeConnectRetry` may remain only for failures positively classified as pre-provider connection failures.
- Approved template page count, page order, page role/title, design direction, and composition remain locked.
- Unchanged pages reuse existing Google Drive files.
- Content revision page input index 0 is always the corresponding approved template page image.
- High-resolution originals remain in Google Drive; Supabase stores structured metadata and Drive identifiers only.
- No implementation/test step may call the real image provider unless the user explicitly authorizes that paid UAT generation.

---

## File Map

### Database
- Create `supabase/migrations/202608190001_framework_template_revision_flow.sql`
- Create `supabase/migrations/202608190002_backfill_tk0001_approved_template.sql`

### Backend
- Create `supabase/functions/uat-ai-design/test-support.ts`
- Create `supabase/functions/uat-ai-design/framework-template-core.ts`
- Create `supabase/functions/uat-ai-design/framework-template-core.test.ts`
- Create `supabase/functions/uat-ai-design/framework-lifecycle-service.ts`
- Create `supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts`
- Create `supabase/functions/uat-ai-design/content-revision-service.ts`
- Create `supabase/functions/uat-ai-design/content-revision-service.test.ts`
- Create `supabase/functions/uat-ai-design/template-revision-prompt.ts`
- Create `supabase/functions/uat-ai-design/template-revision-prompt.test.ts`
- Modify `supabase/functions/uat-ai-design/analysis-service.ts`
- Modify `supabase/functions/uat-ai-design/requirement-prompt.ts`
- Modify `supabase/functions/uat-ai-design/workflow-actions.ts`
- Modify `supabase/functions/uat-ai-design/index.ts`

### Worker
- Create `supabase/functions/uat-seedream-worker/generation-strategy.mjs`
- Create `supabase/functions/uat-seedream-worker/generation-strategy.test.mjs`
- Modify `supabase/functions/uat-seedream-worker/index.ts`
- Test existing `supabase/functions/uat-seedream-worker/worker-policy.mjs` without broadening retry behavior

### Frontend
- Create `js/requester-framework-revision-core.mjs`
- Create `js/requester-framework-revision-core.test.mjs`
- Create `js/requester-framework-revision-flow-v1.js`
- Modify `js/ai-requirement-client.js`
- Modify `js/task-detail-requester.js`
- Modify `js/requester-demo-view-v12.js`
- Modify `js/framework-hd-review-v1.js`
- Modify `supabase-config.js`
- Modify `task-detail-requester.html`

---

### Task 1: Add Framework/Template/Revision Schema

**Files:**
- Create `supabase/migrations/202608190001_framework_template_revision_flow.sql`

**Produces:**
- `uat_framework_adjustments`
- `uat_framework_templates`
- `uat_content_revisions`
- generation linkage columns on `uat_design_generations`

- [ ] **Step 1: Create tables and constraints**

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
  consumed_by_analysis_id uuid references public.uat_requirement_analyses(id),
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
  pages jsonb not null check (jsonb_typeof(pages)='array'),
  created_at timestamptz not null default now()
);

create table if not exists public.uat_content_revisions (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  template_id uuid not null references public.uat_framework_templates(id) on delete restrict,
  analysis_id uuid references public.uat_requirement_analyses(id),
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

- [ ] **Step 2: Add indexes and service-only mutation RLS**

```sql
create index if not exists idx_framework_adjustments_task_created on public.uat_framework_adjustments(task_id,created_at desc);
create index if not exists idx_content_revisions_task_revision on public.uat_content_revisions(task_id,revision_no desc);
create index if not exists idx_generations_revision_page on public.uat_design_generations(revision_id,page_index);

alter table public.uat_framework_adjustments enable row level security;
alter table public.uat_framework_templates enable row level security;
alter table public.uat_content_revisions enable row level security;

create policy "authenticated read framework adjustments" on public.uat_framework_adjustments for select to authenticated using (true);
create policy "authenticated read framework templates" on public.uat_framework_templates for select to authenticated using (true);
create policy "authenticated read content revisions" on public.uat_content_revisions for select to authenticated using (true);
```

No authenticated insert/update/delete policy is added; service-role Edge actions own mutations and validate actor/task permissions.

- [ ] **Step 3: Apply to UAT and verify**

Run on `bjzfkwxrvytgphvgwltl`:

```sql
select table_name from information_schema.tables
where table_schema='public'
and table_name in ('uat_framework_adjustments','uat_framework_templates','uat_content_revisions')
order by table_name;

select column_name from information_schema.columns
where table_schema='public' and table_name='uat_design_generations'
and column_name in ('framework_adjustment_id','template_id','revision_id','generation_mode')
order by column_name;
```

Expected: 3 tables + 4 columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202608190001_framework_template_revision_flow.sql
git commit -m "feat: add framework template revision schema"
```

---

### Task 2: Add Shared Test Support and Pure Template Core

**Files:**
- Create `supabase/functions/uat-ai-design/test-support.ts`
- Create `supabase/functions/uat-ai-design/framework-template-core.ts`
- Create `supabase/functions/uat-ai-design/framework-template-core.test.ts`

**Produces:**
- `createFakeAdmin(seed)` for service tests
- `latestFormalAction(history)`
- `assertFrameworkCanBeApproved(task,history)`
- `assertFrameworkCanBeRejected(task,history)`
- `diffFixedTemplatePages(templatePages,nextPages)`
- `buildRevisionManifest(templatePages,previousManifest,generatedPages)`

- [ ] **Step 1: Create deterministic fake adapter**

`createFakeAdmin` must expose in-memory `.from(table)` behavior used by new services plus:

```ts
admin.countInserts = (table: string) => insertLog.filter((entry) => entry.table === table).length;
admin.rows = (table: string) => structuredClone(store[table] || []);
```

Seed fixtures in each test; do not use network/Supabase.

- [ ] **Step 2: Write failing lifecycle/diff tests**

```ts
Deno.test("only changed P2 is affected", () => {
  const template = [
    { page_index:1, page_title:"封面页", exact_copy:["A"] },
    { page_index:2, page_title:"规则页", exact_copy:["B"] },
    { page_index:3, page_title:"补充页", exact_copy:["C"] },
  ];
  const next = [
    { index:1, title:"封面页", copy:["A"] },
    { index:2, title:"规则页", copy:["B2"] },
    { index:3, title:"补充页", copy:["C"] },
  ];
  assertEquals(diffFixedTemplatePages(template,next).affectedPages,[2]);
});
```

Also test wrong task status, page-count change, page-title/role change, and manifest fallback order.

- [ ] **Step 3: Run red test**

```bash
deno test supabase/functions/uat-ai-design/framework-template-core.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 4: Implement deterministic capacity guard**

Use fixed schema + text-weight threshold:

```ts
export const CAPACITY_GROWTH_RATIO = 1.45;
export const CAPACITY_GROWTH_ABSOLUTE = 120;
const normalize = (v: unknown) => String(v ?? '').replace(/\s+/g,' ').trim();
const copyWeight = (copy: unknown[]) => copy.map(normalize).join('').length;

export function exceedsTemplateCapacity(templateCopy: unknown[], nextCopy: unknown[]) {
  const before = Math.max(1, copyWeight(templateCopy));
  const after = copyWeight(nextCopy);
  const limit = Math.max(Math.ceil(before * CAPACITY_GROWTH_RATIO), before + CAPACITY_GROWTH_ABSOLUTE);
  return after > limit;
}
```

`diffFixedTemplatePages` returns `capacityConflict=true` when page count/role changes or a page exceeds this threshold.

- [ ] **Step 5: Run green test**

```bash
deno test supabase/functions/uat-ai-design/framework-template-core.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uat-ai-design/test-support.ts supabase/functions/uat-ai-design/framework-template-core.ts supabase/functions/uat-ai-design/framework-template-core.test.ts
git commit -m "feat: add template lifecycle and diff core"
```

---

### Task 3: Move Leader Approve/Reject into Backend and Freeze Template

**Files:**
- Create `supabase/functions/uat-ai-design/framework-lifecycle-service.ts`
- Create `supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts`
- Modify `supabase/functions/uat-ai-design/index.ts`
- Modify `js/ai-requirement-client.js`
- Modify `js/task-detail-requester.js`

**Produces:** `approve_framework`, `reject_framework` actions.

- [ ] **Step 1: Write failing service tests using `createFakeAdmin`**

Tests must prove:
- reject: task → `rejected`, history gets `reject_framework`, generation insert count remains 0;
- approve: exact latest `submit_framework` P1/P2/P3 rows become one template row, task → `reviewing`, generation insert count remains 0;
- approving an already templated task rejects with `FRAMEWORK_TEMPLATE_ALREADY_LOCKED`.

- [ ] **Step 2: Run red test**

```bash
deno test supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts
```

- [ ] **Step 3: Implement reject path**

Required update:

```ts
history.push({
  action:'reject_framework', version:submitted.version, reply:reason.trim(),
  operator:actor.label, reply_by:actor.label, is_rejected:true, time:new Date().toISOString(),
});
await admin.from('test_tasks').update({
  status:'rejected',
  summary_desc:`领导驳回框架：${reason.trim()}`,
  history_json:JSON.stringify(history),
}).eq('id',taskId);
```

No generation call exists in this function.

- [ ] **Step 4: Implement approve/template freeze**

Load the generation IDs from the exact submitted history item, validate all are ready/confirmed and Drive-backed, then build:

```ts
const pages = generations.sort((a,b)=>a.page_index-b.page_index).map((row:any)=>({
  page_index:Number(row.page_index),
  page_title:String(row.output?.page_title || `P${row.page_index}`),
  generation_id:row.id,
  drive_file_id:String(row.output?.drive_file_id),
  drive_url:String(row.output?.drive_url || row.output?.image_url || ''),
  exact_copy:Array.isArray(row.output?.exact_copy) ? row.output.exact_copy.map(String) : [],
}));
```

Insert one `uat_framework_templates` row, append `approve_framework`, task → `reviewing`. Do not call `generate_final`.

- [ ] **Step 5: Add role authorization in `index.ts`**

Allowed UAT actor emails:
- `uat.leader@webank.com` → approve/reject only;
- `uat.requester@webank.com` → requester revision/check/accept actions;
- `davis.design.ai@webank.com` → AI analysis/initial explicit generation actions;
- `uat.admin@webank.com` → diagnostic/admin paths only, not requester paid-generation proxy.

- [ ] **Step 6: Route leader UI through Edge**

Add client helpers:

```js
export const approveFramework = (supabase,taskId,note='') => invokeAiAction(supabase,taskId,'approve_framework',{note});
export const rejectFramework = (supabase,taskId,reason) => invokeAiAction(supabase,taskId,'reject_framework',{reason});
```

For AI-assigned tasks, `window.submitApprove`/leader reject must call these helpers instead of direct `updateSupabaseState`.

- [ ] **Step 7: Verify**

```bash
deno test supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts
deno check supabase/functions/uat-ai-design/index.ts
deno check js/ai-requirement-client.js js/task-detail-requester.js
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/uat-ai-design/framework-lifecycle-service.ts supabase/functions/uat-ai-design/framework-lifecycle-service.test.ts supabase/functions/uat-ai-design/index.ts js/ai-requirement-client.js js/task-detail-requester.js
git commit -m "feat: freeze leader approved design template"
```

---

### Task 4: Add Rejected-Framework Requester Adjustment Gate

**Files:**
- Modify `supabase/functions/uat-ai-design/analysis-service.ts`
- Modify `supabase/functions/uat-ai-design/requirement-prompt.ts`
- Modify `supabase/functions/uat-ai-design/workflow-actions.ts`
- Modify `supabase/functions/uat-ai-design/index.ts`
- Create `supabase/functions/uat-ai-design/framework-adjustment.test.ts`

**Produces:** explicit `generate_framework_revision` action.

- [ ] **Step 1: Write failing tests**

Cover:
- empty `requester_direction` → `REQUESTER_DIRECTION_REQUIRED`;
- task not `rejected` → `FRAMEWORK_NOT_WAITING_REQUESTER_DIRECTION`;
- missing idempotency key → `IDEMPOTENCY_KEY_REQUIRED`;
- merely rejecting framework keeps generation count unchanged;
- valid submission stores one adjustment before any generation rows.

- [ ] **Step 2: Add analysis workflow context**

```ts
export type AnalysisWorkflowContext = {
  frameworkAdjustment?: { leaderFeedback:string; requesterDirection:string; supplementalContent:string };
  lockedPageSchema?: Array<{ index:number; title:string }>;
};

export async function analyzeRequirement(admin:any, task:Record<string,any>, userJwt:string, context:AnalysisWorkflowContext={})
```

Pass `workflow_context: context` into `buildRequirementPrompt`.

- [ ] **Step 3: Add framework adjustment prompt block**

When present, render before sources:

```text
FRAMEWORK_ADJUSTMENT_BEGIN
领导原始意见：...
需求方与领导沟通后的执行要求：...
需求方补充内容：...
FRAMEWORK_ADJUSTMENT_END
```

The requester direction controls the next framework design direction; business facts/copy still come from validated sources.

- [ ] **Step 4: Remove legacy automatic generation side effects**

`executeAnalysis()` stops after analysis/state changes. `confirm_understanding` only confirms. `auto_analyze`, source refresh, and clarification answers never call `runDemoGeneration`. Initial Demo remains the separate explicit `generate_demo` action used by the AI designer workspace.

- [ ] **Step 5: Implement `generate_framework_revision`**

Order:
1. verify requester actor;
2. verify task `rejected` + latest formal action `reject_framework`;
3. validate direction + idempotency key;
4. insert adjustment;
5. optionally refresh Tencent source;
6. analyze with adjustment context;
7. if clarification remains, task → `needs_input`, 0 generation rows;
8. if ready, confirm analysis and set `consumed_by_analysis_id`;
9. queue one page row per analysis page with `kind='demo'`, `generation_mode='framework_revision'`, `framework_adjustment_id`, and per-page idempotency key;
10. append `framework_adjustment_submitted`; task → `processing`.

- [ ] **Step 6: Verify**

```bash
deno test supabase/functions/uat-ai-design/framework-adjustment.test.ts supabase/functions/uat-ai-design/analysis-service.test.ts
deno check supabase/functions/uat-ai-design/index.ts supabase/functions/uat-ai-design/analysis-service.ts
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/uat-ai-design/analysis-service.ts supabase/functions/uat-ai-design/requirement-prompt.ts supabase/functions/uat-ai-design/workflow-actions.ts supabase/functions/uat-ai-design/index.ts supabase/functions/uat-ai-design/framework-adjustment.test.ts
git commit -m "feat: gate framework regeneration on requester direction"
```

---

### Task 5: Add Content Check + Prepare Revision Without Generation

**Files:**
- Create `supabase/functions/uat-ai-design/content-revision-service.ts`
- Create `supabase/functions/uat-ai-design/content-revision-service.test.ts`
- Modify `supabase/functions/uat-ai-design/index.ts`

**Produces:** `check_content_update`, `prepare_content_revision`.

- [ ] **Step 1: Write failing tests**

Cover:
- identical content → `no_change`, generation count 0;
- P2-only copy change → affected pages `[2]`;
- page count/title change → `capacity_conflict`, generation count 0;
- >45% or >120-character template-capacity growth beyond deterministic limit → `capacity_conflict`;
- source modes `tencent_doc`, `system_text`, `combined` compute deterministic hashes.

- [ ] **Step 2: Implement hash helper**

```ts
export async function sha256Text(text:string) {
  const data = new TextEncoder().encode(text.replace(/\r\n/g,'\n').trim());
  const digest = await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
```

- [ ] **Step 3: Implement `check_content_update`**

Refresh sources only when requested, compare current Tencent snapshot SHA with template/latest revision hash, return `changed`, old/new hash, and source status. Do not create revision/generation rows.

- [ ] **Step 4: Implement `prepare_content_revision`**

Load immutable template, choose source mode, analyze with `lockedPageSchema`, diff against fixed template page schema, persist `analysis_id`, affected pages, hashes, and status. `capacity_conflict` and `no_change` paths must produce zero generation rows.

- [ ] **Step 5: Verify**

```bash
deno test supabase/functions/uat-ai-design/content-revision-service.test.ts supabase/functions/uat-ai-design/framework-template-core.test.ts
deno check supabase/functions/uat-ai-design/content-revision-service.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uat-ai-design/content-revision-service.ts supabase/functions/uat-ai-design/content-revision-service.test.ts supabase/functions/uat-ai-design/index.ts
git commit -m "feat: prepare content-only template revisions"
```

---

### Task 6: Add Immutable-Template Prompt and Worker Strategies

**Files:**
- Create `supabase/functions/uat-ai-design/template-revision-prompt.ts`
- Create `supabase/functions/uat-ai-design/template-revision-prompt.test.ts`
- Create `supabase/functions/uat-seedream-worker/generation-strategy.mjs`
- Create `supabase/functions/uat-seedream-worker/generation-strategy.test.mjs`
- Modify `supabase/functions/uat-seedream-worker/index.ts`

**Produces:** `initial_framework`, `framework_revision`, `content_revision` worker strategies.

- [ ] **Step 1: Write prompt tests**

Assert `seedream-template-revision-v1` contains `不可变视觉母版` and `禁止重新设计`, contains exact new copy, and does not contain first-round instruction `重新形成视觉概念`.

- [ ] **Step 2: Write strategy tests**

For content revision:

```js
const strategy = resolveGenerationStrategy({
  row:{generation_mode:'content_revision',page_index:2},
  templatePage:{page_index:2,drive_preview_data_url:'data:image/jpeg;base64,TEMPLATE'},
  styleReferences:[{data_url:'data:image/jpeg;base64,STYLE'}],
  assets:[{data_url:'data:image/png;base64,LOGO'}],
});
assert.equal(strategy.images[0],'data:image/jpeg;base64,TEMPLATE');
assert.equal(strategy.completionTarget,'reviewing');
```

Also assert framework revision completion target is `pending_approval`.

- [ ] **Step 3: Implement template revision prompt**

Priority in prompt:
1. immutable approved template page;
2. new exact copy + diff summary;
3. required assets/Logo/IP;
4. external style reference last.

- [ ] **Step 4: Refactor worker scan by `generation_mode`**

Compatibility rule: existing null `generation_mode` Demo rows with current Demo prompt version are treated as `initial_framework`. Framework revision rows are scoped by `framework_adjustment_id`; content rows by `revision_id`.

- [ ] **Step 5: Enforce no retry on unknown provider state**

Thrown gateway fetch / unknown provider state → `failed` with `provider_state_unknown:true`, never requeue. Keep existing `safeConnectRetry` only for `isSafeConnectFailure(message) === true` before provider acceptance is possible.

- [ ] **Step 6: Complete framework revision runs**

When all pages for the same adjustment are ready, append new `submit_framework` with version `v-(previous+1)`, Drive IDs and generation IDs, then task → `pending_approval`. Do not approve automatically.

- [ ] **Step 7: Complete content revision runs**

When all affected pages are ready, call `buildRevisionManifest`, persist complete manifest, revision → `ready_for_review`, append `submit_draft`, task → `reviewing`. Leader is not involved.

- [ ] **Step 8: Verify**

```bash
deno test supabase/functions/uat-ai-design/template-revision-prompt.test.ts
node supabase/functions/uat-seedream-worker/generation-strategy.test.mjs
deno check supabase/functions/uat-seedream-worker/index.ts
```

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/uat-ai-design/template-revision-prompt.ts supabase/functions/uat-ai-design/template-revision-prompt.test.ts supabase/functions/uat-seedream-worker/generation-strategy.mjs supabase/functions/uat-seedream-worker/generation-strategy.test.mjs supabase/functions/uat-seedream-worker/index.ts
git commit -m "feat: add template locked Seedream worker strategies"
```

---

### Task 7: Add Explicit Content Generation + Acceptance Actions

**Files:**
- Modify `supabase/functions/uat-ai-design/content-revision-service.ts`
- Modify `supabase/functions/uat-ai-design/index.ts`
- Modify `js/ai-requirement-client.js`

**Produces:** `generate_content_revision`, `accept_current_revision`.

- [ ] **Step 1: Add failing tests**

Cover:
- missing idempotency key rejects;
- revision `[2]` queues exactly one P2 row;
- generated row stores `analysis_id`, `template_id`, `revision_id`, `generation_mode='content_revision'`, prompt version `seedream-template-revision-v1`;
- acceptance of template-only task creates 0 generation rows;
- acceptance of ready revision marks it `accepted` and creates 0 generation rows.

- [ ] **Step 2: Implement queue action**

Per affected page insert:

```ts
{
  task_id:revision.task_id,
  analysis_id:revision.analysis_id,
  kind:'final',
  generation_mode:'content_revision',
  template_id:revision.template_id,
  revision_id:revision.id,
  page_index,
  page_count:template.page_count,
  model:SEEDREAM_MODEL,
  prompt_version:'seedream-template-revision-v1',
  idempotency_key:`${key}:p${page_index}`,
  status:'queued',
}
```

Only after successful inserts: revision → `generating`, task → `processing`.

- [ ] **Step 3: Implement acceptance**

Accept immutable template if no ready revision exists; otherwise accept latest `ready_for_review` revision. Append `complete`, task → `completed`, no generation code path.

- [ ] **Step 4: Add JS client helpers**

```js
export const checkContentUpdate = (supabase,taskId) => invokeAiAction(supabase,taskId,'check_content_update');
export const prepareContentRevision = (supabase,taskId,payload) => invokeAiAction(supabase,taskId,'prepare_content_revision',payload);
export const generateContentRevision = (supabase,taskId,revisionId) => invokeAiAction(supabase,taskId,'generate_content_revision',{revision_id:revisionId,idempotency_key:newIdempotencyKey()});
export const acceptCurrentRevision = (supabase,taskId) => invokeAiAction(supabase,taskId,'accept_current_revision');
```

- [ ] **Step 5: Verify**

```bash
deno test supabase/functions/uat-ai-design/content-revision-service.test.ts
deno check supabase/functions/uat-ai-design/index.ts
deno check js/ai-requirement-client.js
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/uat-ai-design/content-revision-service.ts supabase/functions/uat-ai-design/index.ts js/ai-requirement-client.js
git commit -m "feat: add explicit revision generation and acceptance"
```

---

### Task 8: Add Requester Workflow UI

**Files:**
- Create `js/requester-framework-revision-core.mjs`
- Create `js/requester-framework-revision-core.test.mjs`
- Create `js/requester-framework-revision-flow-v1.js`
- Modify `js/requester-demo-view-v12.js`
- Modify `js/task-detail-requester.js`
- Modify `supabase-config.js`
- Modify `task-detail-requester.html`

**Produces requester states:**
- `framework_rejected_waiting_requester`
- `template_review`
- `content_revision_draft`
- `content_revision_generating`
- `content_revision_review`
- `capacity_conflict`
- `completed`

- [ ] **Step 1: Write state-selector tests**

```js
assert.equal(selectRequesterFlowState({
  task:{status:'rejected'}, template:null, revisions:[],
  history:[{action:'reject_framework',reply:'方向不合适'}]
}).kind,'framework_rejected_waiting_requester');

assert.equal(selectRequesterFlowState({
  task:{status:'reviewing'}, template:{id:'t1'}, revisions:[],
  history:[{action:'approve_framework'}]
}).kind,'template_review');
```

Also test generating, capacity conflict, revision review, completed.

- [ ] **Step 2: Implement rejected-framework card**

Show rejected framework, leader feedback, required `本轮框架调整要求`, optional Tencent refresh checkbox, optional supplemental text, and one button `提交调整要求，重新生成框架`. Button creates one fresh idempotency key, disables after click, and never auto-retries.

- [ ] **Step 3: Implement template review card**

Exactly two business actions:
- `确认验收并完结`
- `内容需要调整`

No requester control exists for changing style/framework.

- [ ] **Step 4: Implement content update panel**

Tencent button calls only `check_content_update`. System text can be entered independently. `prepare_content_revision` runs before any generation. If result is `capacity_conflict`, show spec conflict copy and hide generation button. If `content_ready`, show affected pages and explicit `提交内容更新并生成新版本` button.

- [ ] **Step 5: Render full current page manifest**

`requester-demo-view-v12.js` loads template + latest ready revision manifest. Each P1/P2/P3 page resolves Drive file ID from manifest, so the requester sees a complete set regardless of page reuse.

- [ ] **Step 6: Neutralize old AI workflow controls**

For `assignee==='davis.design.ai'` with a template/revision flow, old `reviewing` accept/reject buttons in `task-detail-requester.js` do not render. Non-AI legacy tasks keep existing behavior.

- [ ] **Step 7: Bootstrap + cache bust**

Add:

```js
import('./js/requester-framework-revision-flow-v1.js?v=requester-template-revision-v1')
  .then(module=>module.bootstrapRequesterFrameworkRevisionFlowV1(supabase))
  .catch(error=>console.error('需求方母版/内容改版流程加载失败:',error));
```

Update requester page imports from `requester-drive-preview-v10` to `requester-template-revision-v1`.

- [ ] **Step 8: Verify**

```bash
node js/requester-framework-revision-core.test.mjs
deno check js/requester-framework-revision-flow-v1.js js/requester-demo-view-v12.js js/task-detail-requester.js supabase-config.js
```

- [ ] **Step 9: Commit**

```bash
git add js/requester-framework-revision-core.mjs js/requester-framework-revision-core.test.mjs js/requester-framework-revision-flow-v1.js js/requester-demo-view-v12.js js/task-detail-requester.js supabase-config.js task-detail-requester.html
git commit -m "feat: add requester template revision workflow"
```

---

### Task 9: Bind Leader HD Review to Exact Pending Framework Version

**Files:**
- Modify `js/framework-hd-review-v1.js`
- Extend existing framework HD core test file with exact-version selection coverage

- [ ] **Step 1: Add failing history-selection test**

History sequence: `submit_framework v1 → reject_framework v1 → framework_adjustment_submitted → submit_framework v2`. Assert review selector returns only v2 generation/Drive IDs.

- [ ] **Step 2: Implement exact pending-version resolver**

Resolve the latest `submit_framework` that occurs after the latest framework rejection/adjustment cycle and matches current `pending_approval`; never select content revision manifest.

- [ ] **Step 3: Preserve display contract**

Default P1/P2/P3 complete same-screen overview, click page → single-page complete fit, explicit `1:1 看细节` → scrolling.

- [ ] **Step 4: Verify**

```bash
node js/framework-hd-review-core.test.mjs
deno check js/framework-hd-review-v1.js
```

- [ ] **Step 5: Commit**

```bash
git add js/framework-hd-review-v1.js js/framework-hd-review-core.test.mjs
git commit -m "fix: review exact pending framework version"
```

---

### Task 10: Backfill TK-0001 Approved Template Without Generation

**Files:**
- Create `supabase/migrations/202608190002_backfill_tk0001_approved_template.sql`

- [ ] **Step 1: Record live baseline**

```sql
select count(*) as generation_count from public.uat_design_generations where task_id='TK-0001';
```

Expected at plan-writing time: 5 rows (3 ready, 1 failed, 1 cancelled). If different at execution time, inspect first and use the current explicit approved version rather than blindly applying constants.

- [ ] **Step 2: Write idempotent backfill**

Use existing approved v-1 history and existing ready generation IDs:
- `c25b160f-267c-4275-a0b2-8fd620a31c01`
- `c10611ea-fa4f-4241-9693-bfe5cadfbd4f`
- `e91db21d-cf43-4c01-9ad1-8a69859f17b6`

Build `pages` from live generation rows so Drive IDs/exact copy come from DB. Insert only if no template exists. Set task → `reviewing`, summary `领导框架已通过，等待需求方验收或提交内容更新`.

- [ ] **Step 3: Verify unchanged generation count**

```sql
select task_id,framework_version,page_count,pages from public.uat_framework_templates where task_id='TK-0001';
select status,summary_desc from public.test_tasks where id='TK-0001';
select count(*) as generation_count from public.uat_design_generations where task_id='TK-0001';
```

Expected: one template, status `reviewing`, count exactly equal to baseline.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202608190002_backfill_tk0001_approved_template.sql
git commit -m "migrate: freeze TK-0001 approved framework"
```

---

### Task 11: Deploy UAT and Verify Safety/Workflow End-to-End

**Files:** no new product files unless a verification failure exposes a defect.

- [ ] **Step 1: Run all touched tests**

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

- [ ] **Step 2: Deploy verified `uat-ai-design` + `uat-seedream-worker` only to `bjzfkwxrvytgphvgwltl`**

Do not deploy/edit any `supffjeeouibhqdfqosk` function.

- [ ] **Step 3: Verify zero-generation actions with DB/audit counts**

For each action, compare generation count before/after:
- reject framework;
- check content update;
- prepare no-change revision;
- prepare capacity-conflict revision;
- accept current revision.

Expected delta for every action: 0.

- [ ] **Step 4: Verify rejected framework UI without clicking paid generation**

Requester sees leader feedback + required direction input. Generation count remains unchanged until explicit generation button. Do not click paid generation in this verification.

- [ ] **Step 5: Verify TK-0001 requester state**

Expected:
- page stable, no 2-second full-page flashing;
- task in `reviewing`;
- full P1/P2/P3 current set from Drive;
- exactly `确认验收并完结` and `内容需要调整` business choices;
- no style/framework change control;
- Tencent update detection creates zero generation rows.

- [ ] **Step 6: Verify direct acceptance on a disposable fixture**

Acceptance → `completed`, `complete` history, generation delta 0. Do not complete TK-0001 unless user explicitly requests closure.

- [ ] **Step 7: Verify worker failure behavior with fake gateway/tests**

Provider-state-unknown → failed, no automatic requeue. Proven pre-provider safe-connect failure may use existing bounded `safeConnectRetry` only.

- [ ] **Step 8: Final fresh verification before claiming complete**

```sql
select id,status,summary_desc from public.test_tasks where id='TK-0001';
select task_id,framework_version,page_count from public.uat_framework_templates where task_id='TK-0001';
select count(*) as generation_count from public.uat_design_generations where task_id='TK-0001';
```

Report exact test counts, deployed Edge function versions, TK-0001 state, and generation count before/after. No completion claim without these fresh results.
