# AI Visual Reference + Multi-page Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-assigned flat-design requirements require visual references, understand the explicit design scope, and automatically generate one Cloudflare Demo per requested page using those references.

**Architecture:** Store 1–6 compressed visual references per task in a dedicated UAT table. The requester UI can upload, preview, annotate, choose a primary reference, and resume the AI workflow. DeepSeek produces a structured `pages` array from explicit DESIGN_SCOPE; generation creates one row per page and sends the primary reference plus up to three secondary references to FLUX.2 Klein 9B using `input_image_0..3`.

**Tech Stack:** Static HTML/Tailwind/ES modules, Supabase Postgres/RLS/Edge Functions, DeepSeek requirement analysis, Cloudflare Workers AI FLUX.2 Klein 9B.

## Global Constraints

- AI flat-design tasks require at least 1 visual reference before analysis/Demo generation.
- Requester may store 1–6 visual references; exactly one may be primary.
- FLUX.2 Klein 9B receives at most 4 references: primary first, then the next three by sort order.
- Browser compresses model references so longest edge is 500px, satisfying Cloudflare's under-512px input requirement.
- No manual “generate Demo” step in the normal flow.
- Demo count must equal structured page/deliverable count.
- Paid Seedream generation remains user-confirmed; no automatic paid retry.
- 小蓝书 remains fixed at 1242×1660.

---

### Task 1: Visual-reference data model

**Files:**
- Create migration through Supabase: `uat_visual_references` table and `test_tasks.request_type`

**Interfaces:**
- Produces rows `{id, task_id, file_name, data_url, note, is_primary, sort_order, created_by, created_at, updated_at}`.

- [ ] Add `request_type text` to `test_tasks`.
- [ ] Create `uat_visual_references` with FK to `test_tasks(id)` and max one primary row per task.
- [ ] Enable RLS and add participant read plus requester insert/update/delete policies.
- [ ] Add indexes on `task_id` and `(task_id, sort_order)`.
- [ ] Mark TK-0001 as `平面视觉` for this UAT case.

### Task 2: Structured page understanding

**Files:**
- Modify: `supabase/functions/uat-ai-design/requirement-schema.ts`
- Modify: `supabase/functions/uat-ai-design/requirement-prompt.ts`
- Modify tests: `supabase/functions/uat-ai-design/requirement-prompt.test.ts`

**Interfaces:**
- Produces `brief.pages: Array<{ index:number; title:string; copy:string[] }>`.

- [ ] Add failing tests requiring explicit DESIGN_SCOPE to map into `pages` without background/comment-area content.
- [ ] Add `pages` to the requirement brief schema and validation.
- [ ] Upgrade prompt version and instruct DeepSeek to output exact page boundaries/content from DESIGN_SCOPE.
- [ ] Verify existing 小蓝书 size tests still pass.

### Task 3: Reference-aware multi-page Demo generation

**Files:**
- Modify: `supabase/functions/uat-ai-design/demo-client.ts`
- Modify: `supabase/functions/uat-ai-design/generation-service.ts`
- Modify: `supabase/functions/uat-ai-design/index.ts`
- Modify tests: generation/demo client tests.

**Interfaces:**
- `generateCloudflareDemo(prompt, size, references, fetcher)` appends `input_image_0..3`.
- `generateDemoSet(admin, taskId, analysisId)` returns an ordered array of Demo rows.

- [ ] Write failing tests for primary-first reference ordering and multi-page count.
- [ ] Decode stored data URLs into Blob and append up to 4 reference images to multipart FormData.
- [ ] Replace the 1200-character whole-brief truncation with a page-specific prompt containing the exact page copy, shared visual direction and reference notes.
- [ ] Generate one `uat_design_generations` row per page with `page_index/page_count` and a real UUID idempotency key.
- [ ] Block generation with `VISUAL_REFERENCE_REQUIRED` when a flat AI task has no references.
- [ ] Make automatic analysis transition to `waiting_visual_reference` instead of generating when references are absent; resume automatically once references exist.

### Task 4: Requester reference upload UX

**Files:**
- Modify: `index.html`
- Modify: `js/index.js`
- Modify: `task-detail-requester.html`
- Modify: `js/task-detail-requester.js`
- Modify: `js/ai-requirement-client.js`

**Interfaces:**
- Browser helper compresses selected images to JPEG data URLs at max 500px longest edge.
- `saveVisualReferences(supabase, taskId, refs)` persists 1–6 rows.

- [ ] Add a dedicated “视觉参考 / 风格参考” upload area to the create form, separate from generic attachments.
- [ ] Support multiple selection, thumbnails, note per image, primary selection, deletion, max 6.
- [ ] Persist `request_type`; for AI + 平面视觉, submit task initially as `waiting_visual_reference`, save refs, then trigger `auto_analyze` only when at least one reference exists.
- [ ] Add the same visual-reference manager to requester task detail so old/incomplete tasks can upload references later.
- [ ] After the first valid reference is saved for a waiting task, automatically call `auto_analyze`; no Demo button.
- [ ] Load visual references in `loadAiRequirementState` and render their count/primary state.

### Task 5: AI workspace + UAT verification

**Files:**
- Modify: `ai-designer-workspace.html`
- Modify: `test_ai_requirement_ui.sh`
- Deploy: `uat-ai-design` Edge Function

**Interfaces:**
- Workspace renders `Demo 01/N`, model, requested size, and reference count.

- [ ] Show `waiting_visual_reference`, `processing`, `generating_demo`, `demo_review`, and `demo_failed` as explicit live states.
- [ ] Render all Demo pages, not only the last one.
- [ ] Remove the manual Demo generation button from the normal workflow.
- [ ] Deploy the updated Edge Function.
- [ ] Put TK-0001 into `waiting_visual_reference`, remove stale Demo rows, and verify no Demo is generated until the requester uploads a reference.
- [ ] Verify after reference upload the workflow automatically creates 3 Demo rows at 1242×1660 using FLUX.2 Klein 9B.
