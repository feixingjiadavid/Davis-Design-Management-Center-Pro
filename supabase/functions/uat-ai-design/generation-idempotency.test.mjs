import assert from 'node:assert/strict';

let mod = null;
try {
  mod = await import('./generation-idempotency.mjs');
} catch {}

assert.equal(typeof mod?.stableGenerationUuid, 'function', 'stableGenerationUuid must exist');
const p2a = await mod.stableGenerationUuid('ai-content-revision:TK-0001:r1:p2');
const p2b = await mod.stableGenerationUuid('ai-content-revision:TK-0001:r1:p2');
const p3 = await mod.stableGenerationUuid('ai-content-revision:TK-0001:r1:p3');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
assert.match(p2a, uuid);
assert.equal(p2a, p2b);
assert.notEqual(p2a, p3);
console.log('generation idempotency uuid: 4/4 passed');