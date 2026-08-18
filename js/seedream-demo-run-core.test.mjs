import assert from 'node:assert/strict';
import test from 'node:test';
import { isUuid, nextPageIdempotencyKey, uiPhaseKey } from './seedream-demo-run-core.mjs';

test('each page idempotency key is a real UUID accepted by the database', () => {
  const a=nextPageIdempotencyKey();
  const b=nextPageIdempotencyKey();
  assert.equal(isUuid(a),true);
  assert.equal(isUuid(b),true);
  assert.notEqual(a,b);
});

test('local run state participates in UI phase signature', () => {
  assert.notEqual(uiPhaseKey('same-db-signature',true),uiPhaseKey('same-db-signature',false));
});
