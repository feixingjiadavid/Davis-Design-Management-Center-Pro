import assert from 'node:assert/strict';
import test from 'node:test';
import { safeTaskId, outputFileName, isAllowedUatEmail, archiveRelaySignature } from './drive-relay-core.ts';

test('normalizes task id for Drive folders safely', () => {
  assert.equal(safeTaskId('TK-0001'), 'TK-0001');
  assert.equal(safeTaskId('TK 0001/abc'), 'TK-0001-abc');
});

test('uses deterministic Seedream page filenames', () => {
  assert.equal(outputFileName('TK-0001', 2), 'TK-0001_Page02_Seedream4_Demo.jpg');
});

test('only UAT project actors can invoke the shared Drive relay', () => {
  assert.equal(isAllowedUatEmail('davis.design.ai@webank.com'), true);
  assert.equal(isAllowedUatEmail('uat.requester@webank.com'), true);
  assert.equal(isAllowedUatEmail('someone@example.com'), false);
});

test('server relay signature is deterministic but does not expose the Ark key', async () => {
  const key = 'ark-secret-example';
  const first = await archiveRelaySignature(key);
  const second = await archiveRelaySignature(key);
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(first.includes(key), false);
});
