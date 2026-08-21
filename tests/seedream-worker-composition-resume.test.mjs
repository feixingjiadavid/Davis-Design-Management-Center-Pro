import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const worker = fs.readFileSync(new URL('../supabase/functions/uat-seedream-worker/index.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260821094329_allow_composed_svg_in_designs.sql', import.meta.url), 'utf8');

test('worker resumes Composer from a stored raw creative before calling Ark again', () => {
  assert.match(worker, /storedRaw=await existingAsset\(admin,candidate\.id,'raw_creative'\)/);
  assert.match(worker, /if\(storedRaw\)return json/);
  assert.match(worker, /recovered_from_raw:true/);
});

test('formal designs bucket accepts deterministic SVG Composer output', () => {
  assert.match(migration, /where id = 'designs'/);
  assert.match(migration, /'image\/svg\+xml'/);
});

