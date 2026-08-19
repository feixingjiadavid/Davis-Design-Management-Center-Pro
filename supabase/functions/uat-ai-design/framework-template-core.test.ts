import assert from 'node:assert/strict';
import {
  assertFrameworkCanBeApproved,
  assertFrameworkCanBeRejected,
  buildRevisionManifest,
  diffFixedTemplatePages,
  latestFormalAction,
} from './framework-template-core.ts';

Deno.test('leader may reject only pending approval framework', () => {
  assert.doesNotThrow(() => assertFrameworkCanBeRejected({ status: 'pending_approval' }, [{ action: 'submit_framework', version: 'v-2' }]));
  assert.throws(() => assertFrameworkCanBeRejected({ status: 'processing' }, [{ action: 'submit_framework', version: 'v-2' }]), /FRAMEWORK_NOT_PENDING_APPROVAL/);
});

Deno.test('leader may approve only pending approval framework', () => {
  assert.doesNotThrow(() => assertFrameworkCanBeApproved({ status: 'pending_approval' }, [{ action: 'submit_framework', version: 'v-3' }]));
  assert.throws(() => assertFrameworkCanBeApproved({ status: 'rejected' }, [{ action: 'reject_framework', version: 'v-3' }]), /FRAMEWORK_NOT_PENDING_APPROVAL/);
});

Deno.test('latest formal action ignores AI internal events', () => {
  const action = latestFormalAction([
    { action: 'submit_framework', version: 'v-1' },
    { action: 'ai_requirement_analysis' },
    { action: 'reject_framework', version: 'v-1' },
  ]);
  assert.equal(action.action, 'reject_framework');
});

Deno.test('only changed P2 is affected', () => {
  const template = [
    { page_index: 1, page_title: '封面页', exact_copy: ['A'], drive_file_id: 'd1' },
    { page_index: 2, page_title: '规则页', exact_copy: ['B'], drive_file_id: 'd2' },
    { page_index: 3, page_title: '补充页', exact_copy: ['C'], drive_file_id: 'd3' },
  ];
  const next = [
    { index: 1, title: '封面页', copy: ['A'] },
    { index: 2, title: '规则页', copy: ['B2'] },
    { index: 3, title: '补充页', copy: ['C'] },
  ];
  assert.deepEqual(diffFixedTemplatePages(template, next), { affectedPages: [2], capacityConflict: false, reason: null });
});

Deno.test('page count change conflicts', () => {
  const result = diffFixedTemplatePages(
    [{ page_index: 1, page_title: '封面', exact_copy: ['A'] }],
    [{ index: 1, title: '封面', copy: ['A'] }, { index: 2, title: '规则', copy: ['B'] }],
  );
  assert.equal(result.capacityConflict, true);
  assert.equal(result.reason, 'PAGE_COUNT_CHANGED');
});

Deno.test('page title role change conflicts', () => {
  const result = diffFixedTemplatePages(
    [{ page_index: 1, page_title: '封面', exact_copy: ['A'] }],
    [{ index: 1, title: '规则', copy: ['A'] }],
  );
  assert.equal(result.capacityConflict, true);
  assert.equal(result.reason, 'PAGE_ROLE_CHANGED');
});

Deno.test('capacity growth conflicts', () => {
  const before = 'A'.repeat(100);
  const after = 'B'.repeat(221);
  const result = diffFixedTemplatePages(
    [{ page_index: 1, page_title: '封面', exact_copy: [before] }],
    [{ index: 1, title: '封面', copy: [after] }],
  );
  assert.equal(result.capacityConflict, true);
  assert.equal(result.reason, 'PAGE_CAPACITY_EXCEEDED');
});

Deno.test('manifest prefers generated, then previous, then template', () => {
  const template = [
    { page_index: 1, drive_file_id: 't1', drive_url: 'T1' },
    { page_index: 2, drive_file_id: 't2', drive_url: 'T2' },
    { page_index: 3, drive_file_id: 't3', drive_url: 'T3' },
  ];
  const previous = [
    { page_index: 1, source: 'template', drive_file_id: 't1' },
    { page_index: 2, source: 'revision', drive_file_id: 'r1p2', generation_id: 'g-old' },
  ];
  const generated = [{ page_index: 3, id: 'g-new', output: { drive_file_id: 'r2p3', drive_url: 'R2P3' } }];
  const manifest = buildRevisionManifest(template, previous, generated);
  assert.equal(manifest[0].drive_file_id, 't1');
  assert.equal(manifest[1].drive_file_id, 'r1p2');
  assert.equal(manifest[2].drive_file_id, 'r2p3');
  assert.equal(manifest[2].generation_id, 'g-new');
});
