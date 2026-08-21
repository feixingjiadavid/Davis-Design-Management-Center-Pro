# Brand Rule Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic Image Composer and VI gate the only path from AI generation to formal design versions, while preserving raw AI audit history and supporting approved template replacement.

**Architecture:** Seedream writes an immutable private `raw_creative`; a matched Brand Rule creates a composition run and private `composer_preview`; VI checks the exact official asset hashes, geometry, page policy, safe area, and template locks; only a passing public `branded_output` can be published into `design_versions` and `design_version_assets`. Existing `uat_design_generations` remains an independent AI-console audit source.

**Tech Stack:** PostgreSQL/Supabase migrations, RLS and Storage policies, Supabase Edge Functions (Deno/TypeScript), deterministic SVG composition, browser ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-brand-rule-composer-design.md`

## Global Constraints

- Do not create, trace, recolor, resize non-proportionally, or synthesize official logos.
- `brand_assets.asset_type` is extensible non-empty text; it is not restricted to the first two logo types.
- Cultural brand rules remain non-publishable until every required official SVG asset is active.
- `raw_creative` and `composer_preview` can never be inserted into formal delivery tables.
- Formal publication requires `source = branded_output`, a passed VI check, and a public `designs` Storage URL.
- Preserve `uat_design_generations`, its model/prompt/run/retry/failure/debug records, and existing AI-console history.
- Formal delivery must not read `history_json`, Drive URLs, provider URLs, or temporary generation URLs.
- Do not modify requester page structure or requester data logic during Tasks 1–4.

---

### Task 1: Database, Storage, RLS, and release invariants

**Files:**
- Create: `tests/brand-rule-composer-migration.test.mjs`
- Create with Supabase CLI: `supabase/migrations/<timestamp>_brand_rule_composer_foundation.sql`
- Modify: `docs/superpowers/specs/2026-08-21-brand-rule-composer-design.md`

**Interfaces:**
- Produces extensible `brand_assets`, `brand_rules`, `ai_generation_assets`, and `brand_composition_runs` tables.
- Extends `design_templates` with Brand Rule and replace-mode metadata.
- Extends `design_version_assets` with composition lineage and database-enforced branded-output publication.
- Creates `brand-assets` public-read and `ai-generation-assets` private Storage buckets and policies.

- [ ] Write a source-level failing test for table columns, checks, foreign keys, indexes, RLS, grants, Storage buckets/policies, extensible `asset_type`, and the formal publication trigger.
- [ ] Run `node --test tests/brand-rule-composer-migration.test.mjs` and confirm failure because the migration is absent.
- [ ] Run `supabase migration new brand_rule_composer_foundation` to generate the migration filename.
- [ ] Implement additive schema changes, policies, grants, indexes, trigger functions, and two initial rules: active `generic_no_brand` and inactive/draft `culture_activity_default`.
- [ ] Keep `brand_assets` empty and make cultural publication fail closed until official SVGs are uploaded and activated.
- [ ] Amend the approved spec to record the extensible `asset_type` constraint and unique formal release entry.
- [ ] Run the migration test plus `supabase db lint --local` when a local database is available.
- [ ] Apply the exact migration to the linked UAT Supabase project, then query catalog, RLS, Data API grants, Storage bucket state, and security advisors.
- [ ] Commit the migration and its tests.

### Task 2: Brand Rule matcher, template decision, and Creative Area contract

**Files:**
- Create: `supabase/functions/uat-seedream-worker/brand-rule-matcher.mjs`
- Create: `supabase/functions/uat-seedream-worker/brand-rule-matcher.test.mjs`
- Modify: `supabase/functions/uat-seedream-demo-page/creative-prompt.ts`
- Modify: `supabase/functions/uat-seedream-demo-page/creative-prompt.test.ts`
- Modify: `supabase/functions/uat-seedream-worker/generation-strategy.mjs`
- Modify: `supabase/functions/uat-seedream-worker/generation-strategy.test.mjs`

**Interfaces:**
- `resolveGenerationPlan({ task, pageNo, approvedTemplates, brandRules, brandAssets })` returns mode, template lock contract, canvas, Creative Area, required asset IDs, and publishability.
- Approved templates always select `replace_content`; otherwise generation uses `creative_generate`; both receive a Brand Rule.
- Cultural P1 prompt excludes logos and reserves top-left/footer areas; P2–PN use the full creative canvas and request no logos.

- [ ] Write failing tests for OpenTalk approved-template priority, allowlisted replacements, locked fields, cultural P1 safe areas, P2/P3 no-logo behavior, generic fallback, and missing-logo fail-closed state.
- [ ] Run focused tests and confirm the new expectations fail.
- [ ] Implement deterministic matching without relying on model output for template approval or Brand Rule activation.
- [ ] Filter logo assets from Seedream inputs and remove instructions that ask Seedream to draw any logo.
- [ ] Add explicit no-logo and reserved-area instructions derived from the resolved Brand Rule.
- [ ] Run matcher, prompt, and generation-strategy tests.
- [ ] Commit the matcher and Creative Area contract.

### Task 3: Deterministic SVG Composer and VI release gate

**Files:**
- Create: `supabase/functions/uat-seedream-worker/brand-composer.mjs`
- Create: `supabase/functions/uat-seedream-worker/brand-composer.test.mjs`
- Create: `supabase/functions/uat-seedream-worker/vi-check.mjs`
- Create: `supabase/functions/uat-seedream-worker/vi-check.test.mjs`

**Interfaces:**
- `composeBrandedSvg(input)` creates a deterministic full-canvas SVG from the raw Creative Area plus approved template/background and official SVG assets.
- `runViCheck(input)` returns structured check results and `passed`; publication is forbidden unless `passed === true`.
- The composer returns separate immutable descriptors for `composer_preview` and `branded_output`; it never overwrites `raw_creative`.

- [ ] Write failing tests for deterministic output, P1 two-logo placement, P2/P3 zero-logo policy, aspect-ratio preservation, exact SHA-256/source validation, safe-area separation, canvas validation, and missing-asset failure.
- [ ] Run focused tests and confirm failure before implementation.
- [ ] Implement XML escaping, data-URI embedding, deterministic coordinate calculation, and stable manifest hashing without rasterizing or modifying official SVG artwork.
- [ ] Implement VI checks for source table, active asset, hash, coordinates, proportional scale, required/forbidden page assets, safe area, template locks, and canvas dimensions.
- [ ] Ensure any failed check creates a failed composition result and no branded-output descriptor.
- [ ] Run composer and VI tests.
- [ ] Commit Composer and VI gate code.

### Task 4: Worker integration and unique formal publication path

**Files:**
- Modify: `supabase/functions/uat-seedream-worker/index.ts`
- Modify: `supabase/functions/uat-seedream-worker/formal-version-publisher.mjs`
- Modify: `supabase/functions/uat-seedream-worker/formal-version-publisher.test.mjs`
- Create: `supabase/functions/uat-seedream-worker/composition-pipeline.mjs`
- Create: `supabase/functions/uat-seedream-worker/composition-pipeline.test.mjs`

**Interfaces:**
- Provider success persists privately as `ai_generation_assets.stage = raw_creative`.
- The pipeline records `brand_composition_runs`, uploads private preview and public branded output, runs VI, and retains all stages.
- The formal publisher accepts only a passed composition run plus `branded_output` assets and writes lineage into formal assets.

- [ ] Write failing pipeline tests for raw persistence, immutable stage separation, preview persistence, VI pass/fail, idempotent retries, and no formal rows on any failure.
- [ ] Change publisher tests so raw/preview, missing lineage, non-public URLs, or non-passed VI states are rejected.
- [ ] Run focused tests and confirm failure.
- [ ] Integrate Brand Rule resolution before generation and save the generation plan snapshot for audit/retry determinism.
- [ ] Replace direct provider-to-`designs` publication with private raw upload, composition, VI gate, and public branded-output upload.
- [ ] Publish a version only when every expected page has a passing branded output; use database invariants as a second gate.
- [ ] Preserve all current `uat_design_generations` writes and diagnostics; do not make formal delivery depend on `history_json`.
- [ ] Run all worker, prompt, publisher, and existing AI generation regression tests.
- [ ] Deploy changed Edge Functions to UAT and verify service-role read/write permissions.
- [ ] Commit the worker integration.

### Task 5: AI workspace stage display and end-to-end acceptance

**Files:**
- Modify only the existing AI-workspace generation-history module(s) identified by source inspection.
- Create or modify focused AI-workspace rendering tests.
- Do not modify: `task-detail-requester.html`, requester rendering modules, or requester data queries.

**Interfaces:**
- AI workspace shows each generation as Creative Draft → Composer Preview → Final Output, while preserving the existing generation diagnostics and historical version gallery.
- Requester continues to consume only formal `design_versions` and `design_version_assets`, whose database lineage guarantees branded outputs.

- [ ] Write a failing UI source/render test for the three AI stages and a regression guard that the removed standalone Seedream/Drive Demo preview cannot return.
- [ ] Add the minimal AI-workspace stage renderer backed by `ai_generation_assets` and `brand_composition_runs`; hide Storage internals, Drive links, and run IDs from the visual result cards.
- [ ] Run AI-workspace and requester isolation regression tests.
- [ ] Execute Case 1 with fixture official assets: cultural P1 reserves Creative Area and Composer places both required assets; P2/P3 contain none.
- [ ] Execute Case 2 with an approved OpenTalk fixture: `replace_content` is selected and only the six allowed content fields change.
- [ ] Execute Case 3 with live empty official assets: cultural formal publication fails closed and creates no formal asset row.
- [ ] Verify `uat_design_generations` still exposes its existing AI-console audit history.
- [ ] Verify all formal asset URLs are public `designs` URLs and every row traces to a passed branded-output composition.
- [ ] Run the full focused test suite, syntax/type checks, Supabase advisors, and browser validation before claiming completion.
- [ ] Commit and publish the verified implementation to `origin/main` only after all release gates pass.
