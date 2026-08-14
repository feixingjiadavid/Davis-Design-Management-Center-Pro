# Seedream Demo Design Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cloudflare background-plus-SVG Demo path with Seedream 4.0 complete-page generation driven by a design-director prompt, while preserving exact requirement semantics, brand assets, reference-style isolation, and the existing final-generation flow.

**Architecture:** DeepSeek/Qwen remain the understanding layers. `uat-ai-design` will pass the authenticated UAT JWT to the existing `uat-seedream-proxy`, send one primary style reference plus required assets (up to 10 total images), and store the returned complete Seedream page directly as the Demo. The deterministic SVG compositor is removed from the active Demo path; old Cloudflare rows are not reusable for the new Seedream prompt version.

**Tech Stack:** GitHub Pages frontend, Supabase Edge Functions (Deno/TypeScript), Supabase Postgres, DeepSeek, Qwen Vision, Seedream 4.0 proxy.

## Global Constraints

- Demo model is Seedream 4.0 (`doubao-seedream-4-0-250828`).
- Final generation flow remains unchanged and still requires explicit Demo confirmation.
- Style references contribute only visual language; unrelated people, objects, locations, titles, logos, and source copy must not leak into the new design.
- Required IP/Logo/person/brand assets preserve identity and are treated as content assets, not style references.
- Small Blue Book canvas remains `1242x1660px` unless the requirement explicitly overrides it.
- No database migration is required.

---

### Task 1: Lock the new Demo contract with failing tests

**Files:**
- Modify: `supabase/functions/uat-ai-design/generation-service.test.ts`
- Create: `supabase/functions/uat-ai-design/seedream-client.test.ts`

**Interfaces:**
- Produces: tests for `selectModelInputs`, `demoPagePrompt`, `isReusableSeedreamDemo`, and `generateSeedreamDemo`.

- [ ] **Step 1: Replace legacy Cloudflare/SVG expectations with Seedream complete-page expectations**

Add tests asserting that the Demo prompt contains exact page copy, page purpose, audience, visual direction, layout plan, style-analysis anti-copy rules, asset identities, typography/hierarchy guidance, safe margins, and explicitly asks for one complete designed page rather than a blank background.

- [ ] **Step 2: Add the 10-image input contract test**

Assert one primary style reference is first and up to nine required assets follow in `sort_order`.

- [ ] **Step 3: Add reusable-generation scoping test**

Assert old Cloudflare rows or old prompt versions are not reusable, while a current Seedream model + current prompt-version row is reusable.

- [ ] **Step 4: Add Seedream proxy client test**

Use a local fetch stub and assert the client sends `Authorization: Bearer <jwt>`, `task_id`, `page_index`, exact width/height, prompt, and up to 10 images to `uat-seedream-proxy`, and returns provider/model/requested/actual-size metadata.

- [ ] **Step 5: Run tests and confirm RED**

Run: `node --test supabase/functions/uat-ai-design/generation-service.test.ts supabase/functions/uat-ai-design/seedream-client.test.ts`

Expected: FAIL because the new Seedream Demo APIs/behavior do not yet exist.

---

### Task 2: Implement the Seedream Demo provider and design-director prompt

**Files:**
- Modify: `supabase/functions/uat-ai-design/seedream-client.ts`
- Modify: `supabase/functions/uat-ai-design/generation-service.ts`

**Interfaces:**
- Produces: `generateSeedreamDemo(prompt, size, inputs, context, userJwt, fetcher?)` and `isReusableSeedreamDemo(row, model, promptVersion)`.
- Consumes: existing `uat-seedream-proxy` contract (`prompt`, `width`, `height`, `task_id`, `page_index`, `images`).

- [ ] **Step 1: Implement `generateSeedreamDemo`**

Post to `https://supffjeeouibhqdfqosk.supabase.co/functions/v1/uat-seedream-proxy`, forward the UAT JWT, use a 300-second timeout, validate `ok`, `image_url`, and dimension match, and return normalized metadata.

- [ ] **Step 2: Expand `selectModelInputs` from 4 to 10 total images**

Keep exactly one primary style reference first; fill remaining slots with required assets in `sort_order`.

- [ ] **Step 3: Rewrite `demoPagePrompt` as a design-director brief**

The prompt must instruct Seedream to create the complete page, render only the supplied page copy, maintain a clear hierarchy and professional enterprise campaign composition, preserve required asset identities, use style references only for visual grammar, and reject semantic leakage from source reference images.

- [ ] **Step 4: Scope generation reuse to the Seedream model and prompt version**

Use model `doubao-seedream-4-0-250828` and prompt version `seedream-demo-design-director-v1`; ignore legacy Cloudflare Demo rows when finding an active/reusable generation.

- [ ] **Step 5: Replace the active Cloudflare + SVG compositor path**

Call `generateSeedreamDemo` directly and store the returned complete page as `output.image_url`. Persist page metadata, exact copy, style-reference count, design-asset count, input-image count, requested/actual size, and prompt version metadata.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `node --test supabase/functions/uat-ai-design/generation-service.test.ts supabase/functions/uat-ai-design/seedream-client.test.ts`

Expected: PASS.

---

### Task 3: Wire authenticated Demo generation and recovery states

**Files:**
- Modify: `supabase/functions/uat-ai-design/index.ts`
- Modify: `ai-designer-workspace.html`

**Interfaces:**
- `generateDemoSet(admin, taskId, analysisId, userJwt)` receives the caller JWT.

- [ ] **Step 1: Pass the UAT caller JWT through `runDemoGeneration` to `generateDemoSet`**

This allows the UAT Edge Function to call the existing Seedream proxy without moving the ARK secret into the UAT project.

- [ ] **Step 2: Replace all Cloudflare Demo status copy with Seedream Demo copy**

Update Edge Function task summaries and AI-workspace pipeline text.

- [ ] **Step 3: Make failed legacy Demo rows recoverable**

The AI workspace should auto-resume when the task is `ready_for_demo` and the latest Demo is missing or failed, instead of a failed historical row permanently blocking regeneration.

- [ ] **Step 4: Keep final-stage naming and routing unchanged**

`generate_final` continues to route to `uat-seedream-final`.

---

### Task 4: Deploy UAT backend and frontend

**Files:**
- Deploy all current files under `supabase/functions/uat-ai-design/` required by imports.
- GitHub `main` updates publish through the existing Pages flow.

- [ ] **Step 1: Commit backend/client/UI changes to GitHub main**

Use focused commits with Seedream Demo wording.

- [ ] **Step 2: Deploy `uat-ai-design` to Supabase project `bjzfkwxrvytgphvgwltl`**

Deploy with `verify_jwt=true` and the complete dependency set.

- [ ] **Step 3: Confirm Edge Function version is ACTIVE**

Read the deployed function back and verify `seedream-demo-design-director-v1`, Seedream proxy URL, and no active call to `generateCloudflareDemo` in the Demo path.

- [ ] **Step 4: Confirm GitHub Pages shows Seedream Demo copy**

Open the public workspace URL and verify the pipeline text no longer says Cloudflare.

---

### Task 5: Recover and validate the current UAT task

**Files/Data:**
- Supabase tables: `test_tasks`, `uat_requirement_analyses`, `uat_design_generations`.

- [ ] **Step 1: Inspect `TK-0001` state and latest confirmed analysis**

Verify the task has a confirmed analysis, visual-reference analysis, and required assets before triggering a new paid Demo.

- [ ] **Step 2: Reset only the workflow status needed for Demo regeneration**

Do not delete history. Keep old failed Cloudflare rows for audit; set the task to the Seedream Demo resumable state only if the confirmed analysis is still valid.

- [ ] **Step 3: Verify the new generation record contract**

Confirm the new row has `kind='demo'`, Seedream model, `prompt_version='seedream-demo-design-director-v1'`, correct page count, and Seedream output metadata.

- [ ] **Step 4: Verify the user-visible result**

The workspace must show Seedream as the Demo model and render the new complete designed page without deterministic SVG overlay metadata.
