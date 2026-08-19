import assert from 'node:assert/strict';
import { buildArchiveTaskId } from './archive-namespace.mjs';

assert.equal(buildArchiveTaskId({ taskId: 'TK-0001', generationMode: 'initial_framework' }), 'TK-0001');
assert.equal(buildArchiveTaskId({ taskId: 'TK-0001', generationMode: 'framework_revision', frameworkAdjustmentId: '12345678-abcd-ef00-1111-222233334444' }), 'TK-0001__framework-12345678');
assert.equal(buildArchiveTaskId({ taskId: 'TK-0001', generationMode: 'content_revision', revisionNo: 2 }), 'TK-0001__content-r2');
assert.equal(buildArchiveTaskId({ taskId: 'TK 0001/测试', generationMode: 'content_revision', revisionNo: 3 }), 'TK-0001-__content-r3');

console.log('archive namespace: 4/4 passed');
