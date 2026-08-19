import assert from 'node:assert/strict';
import { shouldPollAiRequirement } from './requester-ai-refresh-guard-core.mjs';

assert.equal(shouldPollAiRequirement({ analysisStatus: 'confirmed' }), false, 'confirmed analysis must not poll after leader approval');
assert.equal(shouldPollAiRequirement({ analysisStatus: 'stale' }), false, 'stale analysis must not poll');
assert.equal(shouldPollAiRequirement({ analysisStatus: 'clarification_required' }), true, 'clarification flow may poll AI panel');
assert.equal(shouldPollAiRequirement({ analysisStatus: 'processing' }), true, 'active AI processing may poll AI panel');
console.log('requester ai refresh guard: 4/4 passed');
