import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runViCheck } from './vi-check.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

const assets = [
  { id: 'wesmart', source_table: 'brand_assets', asset_type: 'wesmart_logo', status: 'active', content_sha256: hash('wesmart'), intrinsic_width: 300, intrinsic_height: 84 },
  { id: 'tig-org', source_table: 'brand_assets', asset_type: 'tig_org_logo', status: 'active', content_sha256: hash('tig'), intrinsic_width: 1098, intrinsic_height: 80 },
];

const manifest = {
  pageNo: 1,
  canvas: { x: 0, y: 0, width: 1242, height: 1660 },
  creative: { assetId: 'raw', width: 1242, height: 1260, target: { x: 0, y: 220, width: 1242, height: 1260 } },
  brandAssets: [
    { assetId: 'wesmart', assetType: 'wesmart_logo', sourceTable: 'brand_assets', sha256: hash('wesmart'), intrinsic: { width: 300, height: 84 }, target: { x: 72, y: 64, width: 300, height: 84 }, preserveAspectRatio: true },
    { assetId: 'tig-org', assetType: 'tig_org_logo', sourceTable: 'brand_assets', sha256: hash('tig'), intrinsic: { width: 1098, height: 80 }, target: { x: 72, y: 1516, width: 1098, height: 80 }, preserveAspectRatio: true },
  ],
  outputSha256: hash('output'),
};

const pageRule = {
  apply_brand: true,
  canvas: manifest.canvas,
  creative_area: manifest.creative.target,
  brand_area: { x: 0, y: 0, width: 1242, height: 220, locked: true },
  brand_footer_area: { x: 0, y: 1480, width: 1242, height: 180, locked: true },
  placements: {
    wesmart_logo: { x: 72, y: 64, max_width: 300, max_height: 84, preserve_aspect_ratio: true },
    tig_org_logo: { x: 72, y: 1516, max_width: 1098, max_height: 80, align: 'center', preserve_aspect_ratio: true },
  },
};

test('passes exact official sources, hashes, geometry, page policy, and safe areas', () => {
  const result = runViCheck({ pageNo: 1, pageRule, manifest, brandAssets: assets, outputSha256: hash('output') });
  assert.equal(result.passed, true);
  assert.equal(result.summary.logo, 'PASS');
  assert.equal(result.summary.position, 'PASS');
  assert.equal(result.summary.color, 'PASS');
  assert.ok(result.checks.every((check) => check.passed));
});

test('tampered official hash fails closed', () => {
  const result = runViCheck({
    pageNo: 1,
    pageRule,
    manifest: { ...manifest, brandAssets: [{ ...manifest.brandAssets[0], sha256: hash('tampered') }, manifest.brandAssets[1]] },
    brandAssets: assets,
    outputSha256: hash('output'),
  });
  assert.equal(result.passed, false);
  assert.equal(result.summary.logo, 'FAIL');
  assert.ok(result.checks.some((check) => check.code === 'OFFICIAL_ASSET_SHA256' && !check.passed));
});

test('Creative Area overlap with a locked brand region fails', () => {
  const result = runViCheck({
    pageNo: 1,
    pageRule,
    manifest: { ...manifest, creative: { ...manifest.creative, target: { x: 0, y: 0, width: 1242, height: 1660 } } },
    brandAssets: assets,
    outputSha256: hash('output'),
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((check) => check.code === 'CREATIVE_SAFE_AREA' && !check.passed));
});

test('P2/P3 fails if any brand logo is present', () => {
  const result = runViCheck({
    pageNo: 2,
    pageRule: {
      apply_brand: false,
      canvas: manifest.canvas,
      creative_area: { x: 0, y: 0, width: 1242, height: 1660 },
      forbidden_asset_types: ['wesmart_logo', 'tig_org_logo'],
    },
    manifest: { ...manifest, pageNo: 2, creative: { ...manifest.creative, width: 1242, height: 1660, target: { x: 0, y: 0, width: 1242, height: 1660 } } },
    brandAssets: assets,
    outputSha256: hash('output'),
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((check) => check.code === 'PAGE_BRAND_POLICY' && !check.passed));
});
