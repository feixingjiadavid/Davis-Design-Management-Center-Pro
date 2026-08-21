import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql = fs.readFileSync(new URL('../supabase/migrations/20260821092915_activate_p1_brand_composer_assets.sql', import.meta.url), 'utf8');

test('migration registers both official SVG assets from Supabase Storage', () => {
  assert.match(sql, /official\/wesmart-color\.svg/);
  assert.match(sql, /official\/technology-group-color\.svg/);
  assert.match(sql, /'wesmart_logo'/);
  assert.match(sql, /'tig_org_logo'/);
  assert.match(sql, /'image\/svg\+xml'/);
  assert.match(sql, /storage\/v1\/object\/public\/brand-assets/);
});

test('P1 uses locked brand regions while P2-PN forbid logos', () => {
  assert.match(sql, /"brand_area":\{"x":0,"y":0,"width":1242,"height":220,"locked":true\}/);
  assert.match(sql, /"creative_area":\{"x":0,"y":220,"width":1242,"height":1260,"locked":false\}/);
  assert.match(sql, /"brand_footer_area":\{"x":0,"y":1480,"width":1242,"height":180,"locked":true\}/);
  assert.match(sql, /"wesmart_logo":\{"x":72,"y":64,"max_width":178,"max_height":84,"preserve_aspect_ratio":true\}/);
  assert.match(sql, /"tig_org_logo":\{"x":72,"y":1516,"max_width":1098,"max_height":80,"align":"center","preserve_aspect_ratio":true\}/);
  assert.match(sql, /"default":\{"apply_brand":false/);
  assert.match(sql, /"forbidden_asset_types":\["wesmart_logo","tig_org_logo"\]/);
});

