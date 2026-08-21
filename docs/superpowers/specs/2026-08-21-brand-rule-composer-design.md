# Brand Rule Engine and Deterministic SVG Image Composer Design

**Date:** 2026-08-21  
**Status:** Proposed for implementation approval  
**Scope:** UAT AI design generation, brand composition, VI validation, template binding, AI-workspace display, and formal asset publication.

## 1. Goal

Make the system—not Seedream—authoritative for fixed enterprise brand elements. Every new formal AI design asset must pass through a deterministic SVG Image Composer and a VI release gate before it can be written to `design_version_assets`.

Phase one supports cultural-event posters and two official assets:

- WeSmart logo.
- 科技及智能事业群 logo.

The repository and current Supabase Storage contain neither official SVG. The schema therefore starts with an empty `brand_assets` state. No screenshot conversion, AI redraw, manual tracing, or substitute logo is allowed. Cultural-event brand rules remain `draft` until both official SVGs are uploaded and approved.

## 2. Non-negotiable invariants

1. Seedream never receives, draws, edits, recolors, scales, or positions either logo.
2. Seedream output is retained as `raw_creative`; composition never overwrites it.
3. Image Composer creates `composer_preview`, then promotes identical checked bytes to `branded_output` only after VI PASS.
4. Every new AI-authored `design_version_assets.asset_url` points to a `branded_output` asset.
5. Cultural-event P1 contains both required official logos. Cultural-event P2–PN contains neither logo.
6. Cultural-event P1 Seedream generation uses only the Creative Area dimensions, not the full 1242×1660 canvas.
7. Approved templates use `replace_content`; creative generation is used only when no eligible approved template exists.
8. Both template replacement and creative generation pass through the same Brand Rule, Composer, and VI gate.
9. Every task resolves a Composer rule. Non-cultural tasks use an active `generic_no_brand` pass-through rule; cultural activities require the active cultural rule and official assets.
10. Missing required official brand assets, missing rules, failed composition, or failed VI validation blocks formal publication without rerunning Seedream.
11. The requester sees only `branded_output` through `design_versions` and `design_version_assets`.

## 3. System boundary and asset flow

```text
Requirement analysis
  -> deterministic activity/template matcher
  -> Brand Rule resolution
  -> mode decision
       approved template -> Template Replace Mode
       no approved template -> Creative Generate Mode
  -> raw_creative
  -> deterministic SVG Image Composer
  -> composer_preview
  -> VI Check
       FAIL -> block publication; retain raw and preview; allow composer-only retry
       PASS -> branded_output
  -> design_versions + design_version_assets
```

The AI workspace can display all three stages. Requester and manager formal-delivery components consume only the final formal asset URL.

## 4. Database design

### 4.1 `public.brand_assets`

Stores immutable, approved system brand assets.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `brand_id` | `text` | Required; phase-one values `culture_activity` and `system_default` |
| `asset_type` | `text` | Required non-empty extensible identifier; phase-one values are `wesmart_logo` and `tig_org_logo`, without a closed enum |
| `asset_url` | `text` | Required only when active; Supabase Storage URL |
| `storage_bucket` | `text` | Required only when active; `brand-assets` |
| `storage_path` | `text` | Required only when active |
| `mime_type` | `text` | Must be `image/svg+xml` when active |
| `content_sha256` | `text` | Required 64-character lowercase SHA-256 when active |
| `intrinsic_width` | `numeric` | Positive when active |
| `intrinsic_height` | `numeric` | Positive when active |
| `rule_json` | `jsonb` | Asset-specific color variant and minimum-size metadata |
| `status` | `text` | `draft`, `active`, or `retired`; default `draft` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

Unique active identity: `(brand_id, asset_type)` may have only one active row. Asset bytes are never replaced in place; a changed official file creates a new row and retires the old row.

### 4.2 `public.brand_rules`

Stores deterministic layout and release rules.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `code` | `text` | Unique; `generic_no_brand` or `culture_activity_default` |
| `brand_id` | `text` | Required; `system_default` or `culture_activity` |
| `activity_types` | `text[]` | OpenTalk, TIG周年活动, AICoding分享, 培训活动, 内部文化活动 |
| `canvas_width` | `integer` | 1242 for phase-one 小蓝书 rule |
| `canvas_height` | `integer` | 1660 for phase-one 小蓝书 rule |
| `required_asset_types` | `text[]` | `wesmart_logo`, `tig_org_logo` |
| `page_rules` | `jsonb` | Page-specific canvas, creative, placement, and exclusion rules |
| `template_mode` | `text` | `replace_content` |
| `status` | `text` | `draft`, `active`, or `retired`; default `draft` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

Phase-one P1 rule uses an explicit rectangular Creative Area so the model cannot occupy either system-owned band:

```json
{
  "1": {
    "apply_brand": true,
    "canvas": { "x": 0, "y": 0, "width": 1242, "height": 1660 },
    "brand_area": { "x": 0, "y": 0, "width": 1242, "height": 220, "locked": true },
    "creative_area": { "x": 0, "y": 220, "width": 1242, "height": 1260, "locked": false },
    "brand_footer_area": { "x": 0, "y": 1480, "width": 1242, "height": 180, "locked": true },
    "brand_safe_area": { "top_left_reserved": true, "bottom_reserved": true },
    "placements": {
      "wesmart_logo": { "x": 72, "y": 64, "max_width": 300, "max_height": 84, "preserve_aspect_ratio": true },
      "tig_org_logo": { "x": 72, "y": 1516, "max_width": 1098, "max_height": 80, "align": "center", "preserve_aspect_ratio": true }
    },
    "brand_background": "#FFFFFF"
  },
  "default": {
    "apply_brand": false,
    "canvas": { "x": 0, "y": 0, "width": 1242, "height": 1660 },
    "creative_area": { "x": 0, "y": 0, "width": 1242, "height": 1660, "locked": false },
    "brand_safe_area": { "top_left_reserved": false, "bottom_reserved": false },
    "forbidden_asset_types": ["wesmart_logo", "tig_org_logo"]
  }
}
```

These are UAT defaults, stored as configuration rather than prompt constants. The rule cannot become `active` until the official SVG assets and the placement values are reviewed together.

### 4.3 `public.ai_generation_assets`

Separates the immutable artifacts from a `uat_design_generations` record.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `generation_id` | `uuid` | FK to `uat_design_generations(id)`, cascade delete |
| `task_id` | `text` | FK to `test_tasks(id)`, cascade delete |
| `page_index` | `integer` | Positive |
| `asset_role` | `text` | `raw_creative`, `composer_preview`, or `branded_output` |
| `asset_url` | `text` | Supabase Storage URL |
| `storage_bucket` | `text` | `ai-generation-assets` or `designs` |
| `storage_path` | `text` | Immutable object path |
| `mime_type` | `text` | Image MIME type |
| `width` | `integer` | Actual artifact width |
| `height` | `integer` | Actual artifact height |
| `content_sha256` | `text` | Artifact checksum |
| `metadata` | `jsonb` | Stage-specific manifest |
| `created_at` | `timestamptz` | Default `now()` |

`raw_creative` has a partial unique index on `generation_id`. Preview and output rows are immutable and may have multiple composition attempts; the associated `brand_composition_runs` row identifies the current attempt selected for publication.

### 4.4 `public.brand_composition_runs`

Audits each final-brand composition and its release decision.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `task_id` | `text` | FK to task |
| `generation_id` | `uuid` | FK to generation |
| `page_index` | `integer` | Positive |
| `brand_rule_id` | `uuid` | FK to `brand_rules` |
| `template_id` | `uuid` | Nullable FK to `design_templates` |
| `raw_creative_asset_id` | `uuid` | FK to `ai_generation_assets` |
| `composer_preview_asset_id` | `uuid` | Nullable FK |
| `branded_output_asset_id` | `uuid` | Nullable FK |
| `composition_manifest` | `jsonb` | Canvas, regions, asset IDs, checksums, transforms, and output hash |
| `vi_check` | `jsonb` | Individual check results and measured values |
| `status` | `text` | `queued`, `composing`, `checking`, `passed`, or `failed` |
| `error_code` | `text` | Nullable stable error code |
| `created_at` | `timestamptz` | Default `now()` |
| `completed_at` | `timestamptz` | Set on pass/fail |

### 4.5 Template and formal-delivery changes

Alter `public.design_templates`:

- `brand_rule_id uuid references brand_rules(id)`.
- `template_mode text check (template_mode in ('replace_content','creative_generate'))`.
- `template_asset_url text` for the approved immutable master.

The existing `rules jsonb` stores:

```json
{
  "generation_enabled": true,
  "layout": {},
  "editable_area": [],
  "locked_area": [],
  "variable_slots": ["title", "speaker", "time", "location", "qr_code", "content"],
  "logo_position": "managed_by_brand_rule"
}
```

An approved template is eligible only when all are true:

- `status = 'approved'`.
- `template_mode = 'replace_content'`.
- `brand_rule_id` references an active rule.
- `template_asset_url` exists in Supabase Storage.
- `rules.generation_enabled = true`.
- `rules.editable_area`, `rules.locked_area`, and `rules.variable_slots` are structurally valid.

Alter `public.design_version_assets`:

- Add nullable `source_generation_asset_id uuid references ai_generation_assets(id)` for legacy compatibility.
- All new AI publications must set this field to a row with `asset_role = 'branded_output'` whose composition run has `status = 'passed'`.
- A database trigger rejects every new or updated formal asset without that lineage, including `raw_creative`, `composer_preview`, a failed VI result, a task mismatch, or an asset URL that differs from the branded output row.

Existing historical assets remain valid and unchanged.

## 5. Storage design

### `brand-assets`

- Public-read bucket because the assets are non-secret corporate marks and final output must render reliably.
- Only service-role processes can insert, update, move, or delete.
- Paths are immutable and checksum-addressed: `culture_activity/<asset_type>/<sha256>.svg`.
- SVG is accepted only after server-side sanitization rejects scripts, event handlers, foreign objects, remote resources, and non-image links.

### `ai-generation-assets`

- Private bucket.
- Contains `raw_creative` and `composer_preview`.
- AI workspace reads through authenticated signed URLs or an authorized Edge Function.
- Requester never reads this bucket.

### `designs`

- Existing public bucket.
- Contains only final formal artifacts under `formal-deliveries/...`.
- New AI outputs enter this bucket only after VI PASS.

Supabase RLS is enabled on all new public-schema tables. `brand_assets` and `brand_rules` expose active rows as read-only to authenticated users; writes are service-role only. `ai_generation_assets` and `brand_composition_runs` use `can_access_uat_ai_task(task_id)` for authenticated reads and no client writes. Data API grants and RLS policies are both included because they are separate access layers.

## 6. Migration plan

One migration is generated with `supabase migration new brand_rule_composer_foundation` and contains, in order:

1. Create `brand-assets` and `ai-generation-assets` buckets if absent.
2. Create `brand_assets` with checks, indexes, and the partial unique active-asset index.
3. Create `brand_rules` with JSON shape checks, status checks, and activity-type index.
4. Create `ai_generation_assets` and its stage uniqueness constraint.
5. Create `brand_composition_runs` and generation/task/status indexes.
6. Alter `design_templates` with rule binding and template-mode columns.
7. Alter `design_version_assets` with lineage FK.
8. Enable RLS and add least-privilege grants and policies.
9. Insert `generic_no_brand` as `active`; it defines a full-canvas Creative Area, no fixed brand assets, and the same Composer/VI/publication contract.
10. Insert `culture_activity_default` as `draft` with the P1/default page rules above.
11. Do not insert `brand_assets` rows and do not activate the cultural rule.

Migration verification must cover table constraints, RLS, Data API grants, Storage buckets, and the absence of active rules while official SVGs are missing. Security and performance advisors run after application.

## 7. Brand Rule matching

The matcher is deterministic and runs after requirement facts are normalized but before any image job is queued.

```ts
type BrandMatchInput = {
  taskId: string;
  project?: string;
  requestType?: string;
  title?: string;
  description?: string;
  channels: string[];
  templateRecommendations: Array<{ template_id: string }>;
};

type BrandMatchResult = {
  activityCategory: 'culture_activity' | null;
  brandRuleId: string | null;
  templateId: string | null;
  generationMode: 'replace_content' | 'creative_generate';
  pageRules: Record<string, unknown>;
};
```

Matching precedence:

1. An eligible approved template explicitly recommended by the confirmed analysis.
2. An eligible approved template matched by normalized activity family and page type.
3. Cultural activity with no eligible template: `creative_generate` with the active cultural-event Brand Rule.
4. Cultural event with no active rule or missing official assets: fail closed with `BRAND_RULE_NOT_READY`; do not queue Seedream.
5. Non-cultural task: `creative_generate` with the active `generic_no_brand` rule so every formal AI asset still passes through Composer and VI Check.

The normalized cultural activity dictionary includes OpenTalk, TIG周年活动, AICoding分享, 培训活动, and 内部文化活动. AI may recommend a template, but it cannot activate, override, or fabricate a template or Brand Rule.

## 8. Creative Area generation

### P1 creative generation

For the 1242×1660 rule, Seedream receives a 1242×1260 Creative Area request. It does not receive either official SVG.

Prompt additions are produced from the resolved rule:

```text
Generate only the Creative Area, not the complete poster canvas.
Do not draw, imitate, reconstruct, recolor or modify any logo or brand mark.
Do not include WeSmart or 科技及智能事业群 logos, names used as logo substitutes, or imitation marks.
The system owns a clean brand header above this Creative Area and a brand footer below it.
Keep all critical titles, people, IP characters and visual focal points inside the Creative Area.
```

### P2–PN creative generation

Seedream receives the full 1242×1660 Creative Area. The prompt still forbids both logos and imitation marks. Composer performs a no-logo pass and VI Check confirms absence.

### Template Replace Mode

The approved template owns the layout, background, locked regions, fixed elements, typography rules, and module structure. The template renderer replaces only declared variable slots. Seedream may generate an image-slot creative only when the template declares such an editable slot; it never receives or edits locked brand regions.

## 9. Composer interface

```ts
type ComposeBrandInput = {
  taskId: string;
  generationId: string;
  pageIndex: number;
  pageCount: number;
  brandRuleId: string;
  templateId?: string | null;
  mode: 'replace_content' | 'creative_generate';
  rawCreativeAssetId: string;
  variables?: Record<string, string>;
};

type ViCheckItem = {
  key: 'logo_sha256' | 'logo_source' | 'logo_position' | 'logo_ratio' | 'page_logo_policy' | 'safe_area';
  status: 'PASS' | 'FAIL';
  expected: unknown;
  actual: unknown;
};

type ComposeBrandResult = {
  compositionId: string;
  rawCreativeAssetId: string;
  composerPreviewAssetId: string;
  brandedOutputAssetId?: string;
  brandedOutputUrl?: string;
  manifest: Record<string, unknown>;
  viCheck: ViCheckItem[];
  status: 'passed' | 'failed';
};

export async function composeBrandOutput(input: ComposeBrandInput): Promise<ComposeBrandResult>;
```

The deterministic SVG document contains:

1. Full-canvas background owned by the rule/template.
2. `raw_creative` placed only inside the resolved Creative Area viewbox.
3. Template fixed elements when applicable.
4. P1 official SVG logos placed from `brand_assets` using `preserveAspectRatio`.
5. No logo layers for P2–PN.

The Composer records source asset IDs, source SHA-256 values, placement matrices, clipping rectangles, page policy, and output SHA-256 in `composition_manifest`.

## 10. VI release gate

The gate checks:

- Every required P1 logo source row is active and comes from `brand_assets`.
- Embedded official SVG bytes match `content_sha256`.
- Placement coordinates equal the resolved Brand Rule.
- Aspect ratio equals the official intrinsic ratio within deterministic serialization tolerance.
- P1 contains both required asset IDs exactly once.
- P2–PN contains zero brand-logo layers.
- Creative layer bounds are fully contained by `creative_area` and do not intersect locked areas.
- Output canvas dimensions equal the rule canvas.

On failure:

- `brand_composition_runs.status = 'failed'`.
- `composer_preview` remains visible to the AI designer with check details.
- No `branded_output` is promoted to `designs`.
- No `design_versions` or `design_version_assets` row is published.
- Retry invokes Composer/VI Check only; Seedream is not called again.

On pass:

- Checked bytes are promoted to `designs` as `branded_output`.
- Formal publisher receives only the branded asset row and composition PASS evidence.

## 11. Formal publication contract

`buildFormalVersionPublication` changes from accepting an arbitrary `formal_asset_url` to accepting a validated branded asset descriptor:

```ts
type PublishableBrandedAsset = {
  generationAssetId: string;
  assetRole: 'branded_output';
  assetUrl: string;
  compositionStatus: 'passed';
  pageIndex: number;
};
```

Any raw URL, provider URL, Drive URL, `raw_creative`, `composer_preview`, missing lineage ID, or failed composition is rejected before database writes.

## 12. AI workspace and requester behavior

AI workspace version detail shows, for each generation:

```text
Creative Draft
  -> Composer Preview
  -> Final Output / VI blocked
```

It may show VI check status and failure reasons, but must not duplicate the formal history gallery.

Requester behavior does not change structurally. Its sole image source remains:

```text
design_versions
  -> design_version_assets.asset_url
```

Because only `branded_output` is formally published, the requester can never receive `raw_creative` or `composer_preview`.

## 13. Tests and acceptance

### Unit tests

- Activity matcher selects an eligible approved template before creative mode.
- Archived, draft, rejected, incomplete, or generation-disabled templates never match.
- Cultural activity without active assets/rule fails closed before Seedream.
- P1 resolves 1242×1260 Creative Area; P2–PN resolves 1242×1660.
- Logo assets are filtered from all Seedream model inputs.
- P1 prompt includes no-logo and system-owned band instructions.
- P2–PN prompt includes no-logo instruction without P1 reserved bands.
- Composer preserves source hashes, aspect ratios, and exact placements.
- P2–PN composition contains no logo layers.
- VI failure blocks `branded_output` and formal publication.
- Formal publisher rejects raw/provider/Drive/preview assets.
- Template mode replaces only declared variables and never changes locked areas.

### Integration tests

- Empty `brand_assets` leaves `culture_activity_default` inactive and blocks cultural-event generation.
- After official SVG upload and activation, P1 produces all three asset stages and a formal branded URL.
- P2/P3 produce raw, preview, and final assets with zero logo layers.
- Composer retry does not create another Seedream request.
- Requester queries return only `branded_output` lineage.
- AI workspace can read the three internal stages for authorized tasks.

### Acceptance sequence

```text
Create cultural event
-> match approved template if eligible, otherwise creative mode
-> P1 Seedream generates only Creative Area
-> raw_creative retained
-> Composer creates full 1242×1660 canvas
-> official WeSmart logo at locked top placement
-> official 科技及智能事业群 logo at locked footer placement
-> VI PASS
-> branded_output published
-> P2/P3 contain no logos
-> requester sees only final branded version
```

## 14. Rollout and compatibility

1. Apply schema with draft rule and empty assets; no existing output behavior changes.
2. Deploy matcher and Composer behind a server-side `BRAND_COMPOSER_ENABLED` flag defaulting to false.
3. Enable the Composer for all new AI publications using `generic_no_brand`; verify formal lineage without changing visual output.
4. Upload and approve the two official SVG assets.
5. Validate and activate `culture_activity_default`.
6. Enable cultural-event matching and locked P1 branding.
7. Backfill is not automatic: historical formal versions remain untouched.
8. After acceptance, keep Composer mandatory for every new AI publication; Brand Rule decides whether fixed brand elements are applied.

The change is additive and does not alter requester page structure, existing historical versions, or the AI console's raw generation audit records.
