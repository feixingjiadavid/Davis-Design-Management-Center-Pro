import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRecoverNeedsInput } from './ai-auto-recovery.js';

test('recovers needs_input when there are no actionable blockers', () => {
  assert.equal(shouldRecoverNeedsInput({
    taskStatus: 'needs_input',
    openClarificationCount: 0,
    brief: { missing_information: [], clarification_questions: [] },
  }), true);
});

test('does not recover needs_input when an open question remains', () => {
  assert.equal(shouldRecoverNeedsInput({
    taskStatus: 'needs_input',
    openClarificationCount: 1,
    brief: { missing_information: [], clarification_questions: [] },
  }), false);
});

test('does not recover needs_input when hard information is still missing', () => {
  assert.equal(shouldRecoverNeedsInput({
    taskStatus: 'needs_input',
    openClarificationCount: 0,
    brief: { missing_information: ['最终Logo素材'], clarification_questions: [] },
  }), false);
});
