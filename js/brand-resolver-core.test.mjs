import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBrandAssets, validateResolvedAssets } from './brand-resolver-core.js';

const registry = {
  assets: {
    wesmart: {
      level: 'culture',
      source: 'google_drive',
      editable: false,
      priority: 1,
      variants: {
        color: { drive_file_id: 'wesmart-color' },
        white: { drive_file_id: 'wesmart-white' }
      }
    },
    tech_group: {
      level: 'department',
      source: 'google_drive',
      editable: false,
      priority: 2,
      variants: {
        color: { drive_file_id: 'tech-color' },
        white: { drive_file_id: 'tech-white' }
      }
    },
    webank: {
      level: 'corporate',
      source: 'google_drive',
      editable: false,
      variants: {
        color: { drive_file_id: 'webank-color' },
        white: { drive_file_id: 'webank-white' }
      }
    }
  },
  rules: {
    culture_event: {
      required: ['wesmart'],
      optional: ['tech_group']
    },
    corporate_event: {
      required: ['webank']
    }
  }
};

test('P1 culture event resolves official logos', () => {
  const result = resolveBrandAssets({ scene: 'culture_event', background: 'light' }, registry);
  assert.equal(result.selectedAssets.length, 2);
  assert.equal(result.selectedAssets[0].brand, 'wesmart');
  assert.equal(result.selectedAssets[0].variant, 'color');
  assert.equal(validateResolvedAssets(result).passed, true);
});

test('dark scene selects white logo variant', () => {
  const result = resolveBrandAssets({ scene: 'culture_event', background: 'dark' }, registry);
  assert.equal(result.selectedAssets[0].variant, 'white');
});
