import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGenerationStrategy } from './generation-strategy.mjs';

test('content revision anchors approved template first', () => {
  const strategy = resolveGenerationStrategy({
    row: { generation_mode: 'content_revision', page_index: 2 },
    templatePage: { page_index: 2, drive_preview_data_url: 'data:image/jpeg;base64,TEMPLATE' },
    styleReferences: [{ data_url: 'data:image/jpeg;base64,STYLE' }],
    assets: [{ data_url: 'data:image/png;base64,LOGO' }],
  });
  assert.equal(strategy.images[0], 'data:image/jpeg;base64,TEMPLATE');
  assert.equal(strategy.completionTarget, 'reviewing');
  assert.equal(strategy.promptVersion, 'seedream-template-revision-v1');
});

test('framework revision returns to leader approval', () => {
  const strategy = resolveGenerationStrategy({
    row: { generation_mode: 'framework_revision' },
    styleReferences: [],
    assets: [],
    adjustment: { requester_direction: '更简洁' },
  });
  assert.equal(strategy.completionTarget, 'pending_approval');
  assert.equal(strategy.promptKind, 'creative_framework_revision');
});

test('legacy null mode is initial framework', () => {
  const strategy = resolveGenerationStrategy({ row: { generation_mode: null } });
  assert.equal(strategy.mode, 'initial_framework');
  assert.equal(strategy.completionTarget, 'pending_approval');
});

test('creative generation excludes logo files from Seedream image inputs', () => {
  const strategy = resolveGenerationStrategy({
    row: { generation_mode: 'initial_framework' },
    styleReferences: [{ data_url: 'style' }],
    assets: [
      { data_url: 'logo', asset_role: 'WeSmart Logo', file_name: 'wesmart.svg' },
      { data_url: 'ip', asset_role: 'TIG IP', file_name: 'tig-ip.png' },
    ],
  });
  assert.deepEqual(strategy.images, ['style', 'ip']);
});

test('strategy carries the resolved Creative Area contract', () => {
  const brandPlan = {
    mode: 'creative_generate',
    creativeArea: { x: 0, y: 220, width: 1242, height: 1260 },
    safeArea: { top_left_reserved: true, bottom_reserved: true },
    publishable: false,
    blockReason: 'BRAND_RULE_INACTIVE',
  };
  const strategy = resolveGenerationStrategy({ row: {}, brandPlan });
  assert.deepEqual(strategy.creativeArea, brandPlan.creativeArea);
  assert.deepEqual(strategy.brandPlan, brandPlan);
});
