import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { composeBrandedSvg } from './brand-composer.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const dataUrl = (mime, value) => `data:${mime};base64,${Buffer.from(value).toString('base64')}`;

const wesmartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="84"><path fill="#00f" d="M0 0h300v84H0z"/></svg>';
const tigSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1098" height="80"><path fill="#111" d="M0 0h1098v80H0z"/></svg>';
const assets = [
  { id: 'wesmart', source_table: 'brand_assets', brand_id: 'culture_activity', asset_type: 'wesmart_logo', status: 'active', mime_type: 'image/svg+xml', svg_text: wesmartSvg, content_sha256: hash(wesmartSvg), intrinsic_width: 300, intrinsic_height: 84 },
  { id: 'tig-org', source_table: 'brand_assets', brand_id: 'culture_activity', asset_type: 'tig_org_logo', status: 'active', mime_type: 'image/svg+xml', svg_text: tigSvg, content_sha256: hash(tigSvg), intrinsic_width: 1098, intrinsic_height: 80 },
];

const p1Rule = {
  apply_brand: true,
  canvas: { x: 0, y: 0, width: 1242, height: 1660 },
  creative_area: { x: 0, y: 220, width: 1242, height: 1260 },
  brand_area: { x: 0, y: 0, width: 1242, height: 220, locked: true },
  brand_footer_area: { x: 0, y: 1480, width: 1242, height: 180, locked: true },
  brand_safe_area: { top_left_reserved: true, bottom_reserved: true },
  placements: {
    wesmart_logo: { x: 72, y: 64, max_width: 300, max_height: 84, preserve_aspect_ratio: true },
    tig_org_logo: { x: 72, y: 1516, max_width: 1098, max_height: 80, align: 'center', preserve_aspect_ratio: true },
  },
  brand_background: '#FFFFFF',
};

test('P1 composition is deterministic and embeds exact official SVG bytes', async () => {
  const input = {
    pageNo: 1,
    pageRule: p1Rule,
    rawCreative: { id: 'raw', data_url: dataUrl('image/png', 'creative-image'), width: 1242, height: 1260, content_sha256: hash('creative-image') },
    brandAssets: assets,
  };
  const first = await composeBrandedSvg(input);
  const second = await composeBrandedSvg(input);
  assert.equal(first.svg, second.svg);
  assert.equal(first.contentSha256, second.contentSha256);
  assert.deepEqual(first.manifest.canvas, p1Rule.canvas);
  assert.deepEqual(first.manifest.creative.target, p1Rule.creative_area);
  assert.deepEqual(first.manifest.brandAssets.map((asset) => asset.assetType), ['wesmart_logo', 'tig_org_logo']);
  assert.ok(first.svg.includes(Buffer.from(wesmartSvg).toString('base64')));
  assert.ok(first.svg.includes(Buffer.from(tigSvg).toString('base64')));
  assert.match(first.svg, /preserveAspectRatio="xMidYMid meet"/);
});

test('P2 and later pages contain no brand assets', async () => {
  const result = await composeBrandedSvg({
    pageNo: 2,
    pageRule: {
      apply_brand: false,
      canvas: { x: 0, y: 0, width: 1242, height: 1660 },
      creative_area: { x: 0, y: 0, width: 1242, height: 1660 },
      forbidden_asset_types: ['wesmart_logo', 'tig_org_logo'],
    },
    rawCreative: { id: 'raw-p2', data_url: dataUrl('image/png', 'p2'), width: 1242, height: 1660, content_sha256: hash('p2') },
    brandAssets: assets,
  });
  assert.deepEqual(result.manifest.brandAssets, []);
  assert.doesNotMatch(result.svg, /image\/svg\+xml/);
});

test('missing required P1 asset fails before any output is produced', async () => {
  await assert.rejects(
    composeBrandedSvg({
      pageNo: 1,
      pageRule: p1Rule,
      rawCreative: { id: 'raw', data_url: dataUrl('image/png', 'creative-image'), width: 1242, height: 1260, content_sha256: hash('creative-image') },
      brandAssets: assets.slice(0, 1),
    }),
    /BRAND_ASSET_REQUIRED:tig_org_logo/,
  );
});

test('unsafe official SVG content is rejected instead of embedded', async () => {
  const unsafeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  await assert.rejects(
    composeBrandedSvg({
      pageNo: 1,
      pageRule: p1Rule,
      rawCreative: { id: 'raw', data_url: dataUrl('image/png', 'creative-image'), width: 1242, height: 1260, content_sha256: hash('creative-image') },
      brandAssets: [{ ...assets[0], svg_text: unsafeSvg, content_sha256: hash(unsafeSvg) }, assets[1]],
    }),
    /BRAND_ASSET_SVG_UNSAFE:wesmart_logo/,
  );
});

test('logo placement always preserves intrinsic aspect ratio within locked boxes', async () => {
  const result = await composeBrandedSvg({
    pageNo: 1,
    pageRule: p1Rule,
    rawCreative: { id: 'raw', data_url: dataUrl('image/png', 'creative-image'), width: 1242, height: 1260, content_sha256: hash('creative-image') },
    brandAssets: [{ ...assets[0], intrinsic_width: 600, intrinsic_height: 84 }, assets[1]],
  });
  const placement = result.manifest.brandAssets[0].target;
  assert.equal(placement.width, 300);
  assert.equal(placement.height, 42);
  assert.equal(placement.x, 72);
  assert.equal(placement.y, 64);
});
