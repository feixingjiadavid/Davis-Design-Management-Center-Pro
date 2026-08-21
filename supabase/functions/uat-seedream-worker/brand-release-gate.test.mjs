import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFormalRelease } from './brand-release-gate.mjs';

test('only passed branded output can release', () => {
  const result = validateFormalRelease({
    compositionRun: { status: 'passed', vi_check: { passed: true } },
    asset: {
      asset_role: 'branded_output',
      storage_bucket: 'designs',
      asset_url: 'https://demo/storage/v1/object/public/designs/final.svg'
    }
  });

  assert.equal(result.passed, true);
});

test('raw creative cannot release', () => {
  const result = validateFormalRelease({
    compositionRun: { status: 'passed', vi_check: { passed: true } },
    asset: {
      asset_role: 'raw_creative',
      storage_bucket: 'ai-generation-assets',
      asset_url: 'private'
    }
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures.includes('BRANDED_OUTPUT_REQUIRED'));
});
