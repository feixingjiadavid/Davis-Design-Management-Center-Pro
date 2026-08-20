import assert from 'node:assert/strict';
import { selectRevisionModel, isModelAllowedForMode, SEEDREAM_40, SEEDREAM_45, SEEDREAM_50 } from './content-revision-model-router.mjs';

assert.equal(selectRevisionModel({ relation:'new_requirement' }), SEEDREAM_45);
assert.equal(selectRevisionModel({ relation:'quality_retry' }), SEEDREAM_50);
assert.equal(selectRevisionModel({ relation:'unknown' }), SEEDREAM_45);
assert.equal(isModelAllowedForMode('initial_framework', SEEDREAM_40), true);
assert.equal(isModelAllowedForMode('framework_revision', SEEDREAM_40), true);
assert.equal(isModelAllowedForMode('initial_framework', SEEDREAM_45), false);
assert.equal(isModelAllowedForMode('content_revision', SEEDREAM_45), true);
assert.equal(isModelAllowedForMode('content_revision', SEEDREAM_50), true);
assert.equal(isModelAllowedForMode('content_revision', SEEDREAM_40), false);
console.log('content revision model router tests passed');
