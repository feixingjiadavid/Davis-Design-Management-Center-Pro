# DeepSeek Requirement Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the UAT requirement-analysis model call with DeepSeek while preserving grounded structured output, clarification gates, and the existing Supabase security boundary.

**Architecture:** Add a focused DeepSeek OpenAI-compatible HTTP client beside the existing provider clients. `analysis-service.ts` reads `DEEPSEEK_API_KEY` and `DEEPSEEK_REQUIREMENT_MODEL`, calls the new client, validates the same `RequirementBrief`, and persists the actual DeepSeek model name. The existing Cloudflare Demo and Seedream final-image paths remain unchanged.

**Authorized deployment note:** The DeepSeek key was found to be available only to the formal Supabase project. With explicit user authorization, the implementation keeps that key in place and adds `uat-deepseek-proxy`, which verifies the original UAT JWT against UAT Auth and permits only the four UAT test accounts. The proxy has no formal-database access path in its request flow.

**Tech Stack:** Supabase Edge Functions, Deno TypeScript, DeepSeek Chat Completions JSON Output, Node test runner, GitHub Pages.

## Global Constraints

- Default requirement model is `deepseek-v4-flash`.
- The API key is read only from Supabase Secret `DEEPSEEK_API_KEY`.
- The model can be overridden with Supabase Secret `DEEPSEEK_REQUIREMENT_MODEL`.
- No fixed or fabricated requirement analysis is allowed.
- Cloudflare remains the Demo provider; Seedream 4.0 remains the final-image provider.
- The formal Supabase project must not be modified.

---

### Task 1: DeepSeek structured requirement client

**Files:**
- Create: `supabase/functions/uat-ai-design/deepseek-client.ts`
- Create: `supabase/functions/uat-ai-design/deepseek-client.test.ts`

**Interfaces:**
- Produces: `callDeepSeekRequirementModel(prompt, config, fetcher?)`
- Returns: `{ brief: RequirementBrief; usage: Record<string, unknown> }`

- [ ] **Step 1: Write failing tests**

Test that the client sends `Authorization: Bearer`, model `deepseek-v4-flash`, `response_format.type = json_object`, parses `choices[0].message.content`, and rejects missing configuration, non-2xx responses, empty content, and invalid JSON.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --experimental-strip-types --test supabase/functions/uat-ai-design/deepseek-client.test.ts`

Expected: FAIL because `deepseek-client.ts` does not exist.

- [ ] **Step 3: Implement the minimal client**

Use `POST https://api.deepseek.com/chat/completions`, a 60-second timeout, temperature `0.1`, non-streaming output, and JSON Output. Validate the parsed result with `validateRequirementBrief`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --experimental-strip-types --test supabase/functions/uat-ai-design/deepseek-client.test.ts`

Expected: all DeepSeek client tests PASS.

### Task 2: Switch analysis orchestration to DeepSeek

**Files:**
- Modify: `supabase/functions/uat-ai-design/analysis-service.ts`
- Modify: `supabase/functions/uat-ai-design/analysis-service.test.ts`
- Modify: `test_uat_ai_edge_contract.sh`

**Interfaces:**
- Consumes: `callDeepSeekRequirementModel`
- Preserves: `analyzeRequirement`, `decideAnalysisStatus`, confirmation and clarification interfaces

- [ ] **Step 1: Add a failing provider-contract assertion**

Assert that analysis imports the DeepSeek client, reads `DEEPSEEK_API_KEY`, defaults to `deepseek-v4-flash`, and no longer reads `CLOUDFLARE_REQUIREMENT_MODEL`.

- [ ] **Step 2: Run contract test and verify RED**

Run: `bash test_uat_ai_edge_contract.sh`

Expected: FAIL because analysis still uses the Cloudflare requirement client.

- [ ] **Step 3: Replace only the requirement-analysis provider**

Import the DeepSeek client, resolve `DEEPSEEK_REQUIREMENT_MODEL || "deepseek-v4-flash"`, pass `DEEPSEEK_API_KEY`, and persist that model. Leave Demo and final generation providers unchanged.

- [ ] **Step 4: Run the full backend suite**

Run: `node --experimental-strip-types --test supabase/functions/uat-ai-design/*.test.ts && bash test_uat_ai_edge_contract.sh`

Expected: all tests PASS.

### Task 3: Surface provider identity and deploy UAT

**Files:**
- Modify: `ai-designer-workspace.html`
- Modify: `test_ai_requirement_ui.sh`
- Deploy: Supabase Edge Function `uat-ai-design` in project `bjzfkwxrvytgphvgwltl`

**Interfaces:**
- Frontend copy: `需求理解大脑：DeepSeek`

- [ ] **Step 1: Add failing UI assertion**

Add a contract assertion for `需求理解大脑：DeepSeek` and run `bash test_ai_requirement_ui.sh`; expect failure before the copy is added.

- [ ] **Step 2: Add minimal provider-status copy**

Display DeepSeek as the requirement brain without exposing configuration values or secrets.

- [ ] **Step 3: Run fresh verification**

Run all TypeScript tests, shell contract tests, `node --check` on changed browser JavaScript, and `git diff --check`.

- [ ] **Step 4: Deploy and verify**

Deploy Edge Function with JWT verification enabled. Confirm the function is ACTIVE, publish the frontend to `main`, and confirm GitHub Pages builds the exact new commit.

- [ ] **Step 5: Run real UAT analysis**

Use the authenticated UAT flow on `TK-0001`: read sources, analyze, then query `uat_requirement_analyses` for a new row whose model begins with `deepseek-` and whose facts contain source locators. If the configured secret name differs, inspect the existing function convention and adapt only the environment-variable name without revealing the secret value.
