import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildCompositionArtifacts, buildWorkspaceDisplayFields, stageStoragePath } from './composition-pipeline.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const dataUrl = (value) => `data:image/png;base64,${Buffer.from(value).toString('base64')}`;
const logo = (id, assetType, width, height) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="M0 0h${width}v${height}H0z"/></svg>`;
  return { id, source_table: 'brand_assets', brand_id: 'culture_activity', asset_type: assetType, status: 'active', mime_type: 'image/svg+xml', svg_text: svg, content_sha256: hash(svg), intrinsic_width: width, intrinsic_height: height };
};

const plan = {
  publishable: true,
  blockReason: null,
  brandRule: { id: 'rule', code: 'culture_activity_default' },
  pageRule: {
    apply_brand: true,
    canvas: { x: 0, y: 0, width: 1242, height: 1660 },
    creative_area: { x: 0, y: 220, width: 1242, height: 1260 },
    brand_area: { x: 0, y: 0, width: 1242, height: 220, locked: true },
    brand_footer_area: { x: 0, y: 1480, width: 1242, height: 180, locked: true },
    placements: {
      wesmart_logo: { x: 72, y: 64, max_width: 300, max_height: 84, preserve_aspect_ratio: true },
      tig_org_logo: { x: 72, y: 1516, max_width: 1098, max_height: 80, align: 'center', preserve_aspect_ratio: true },
    },
  },
};

const raw = { id: 'raw-id', data_url: dataUrl('creative'), width: 1242, height: 1260, content_sha256: hash('creative') };
const brandAssets = [logo('wesmart', 'wesmart_logo', 300, 84), logo('tig', 'tig_org_logo', 1098, 80)];

test('keeps raw, preview, and branded output as distinct immutable stages', async () => {
  const result = await buildCompositionArtifacts({ pageNo: 1, brandPlan: plan, rawCreative: raw, brandAssets });
  assert.equal(result.passed, true);
  assert.equal(result.preview.asset_role, 'composer_preview');
  assert.equal(result.preview.storage_bucket, 'ai-generation-assets');
  assert.equal(result.brandedOutput.asset_role, 'branded_output');
  assert.equal(result.brandedOutput.storage_bucket, 'designs');
  assert.equal(result.preview.content_sha256, result.brandedOutput.content_sha256);
  assert.equal(raw.id, 'raw-id');
  assert.equal(result.viCheck.passed, true);
});

test('inactive rule records a failed gate and produces no preview or formal output', async () => {
  const result = await buildCompositionArtifacts({
    pageNo: 1,
    brandPlan: { ...plan, publishable: false, blockReason: 'BRAND_RULE_INACTIVE' },
    rawCreative: raw,
    brandAssets: [],
  });
  assert.equal(result.passed, false);
  assert.equal(result.errorCode, 'BRAND_RULE_INACTIVE');
  assert.equal(result.preview, null);
  assert.equal(result.brandedOutput, null);
});

test('stage paths are checksum-addressed and never overlap', () => {
  const args = { taskId: 'TK 1', generationId: 'gen/1', pageIndex: 1, sha256: 'a'.repeat(64) };
  const rawPath = stageStoragePath({ ...args, stage: 'raw_creative', extension: 'png' });
  const previewPath = stageStoragePath({ ...args, stage: 'composer_preview', extension: 'svg' });
  const outputPath = stageStoragePath({ ...args, stage: 'branded_output', extension: 'svg' });
  assert.match(rawPath, /raw_creative/);
  assert.match(previewPath, /composer_preview/);
  assert.match(outputPath, /formal-deliveries/);
  assert.equal(new Set([rawPath, previewPath, outputPath]).size, 3);
});

test('workspace display fields point only to the branded output asset', () => {
  assert.deepEqual(buildWorkspaceDisplayFields({
    id: 'final-id',
    asset_role: 'branded_output',
    asset_url: 'https://project.supabase.co/storage/v1/object/public/designs/final.svg',
  }), {
    branded_output_asset_id: 'final-id',
    workspace_display_url: 'https://project.supabase.co/storage/v1/object/public/designs/final.svg',
  });
  assert.deepEqual(buildWorkspaceDisplayFields({
    id: 'raw-id',
    asset_role: 'raw_creative',
    asset_url: 'private-raw',
  }), {
    branded_output_asset_id: null,
    workspace_display_url: null,
  });
});

