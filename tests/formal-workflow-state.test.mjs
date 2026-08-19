import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRenderDashboard, resolveAiPipelineStage, isFormalLeader } from '../js/formal-workflow-state.mjs';

test('silent dashboard refresh renders when task snapshot changes', () => {
  assert.equal(shouldRenderDashboard('[]', '[{"id":"TK-0001","status":"pending_approval"}]', true), true);
  assert.equal(shouldRenderDashboard('same', 'same', true), false);
  assert.equal(shouldRenderDashboard('same', 'same', false), true);
});

test('AI pipeline inserts formal leader framework approval between Demo and final', () => {
  assert.equal(resolveAiPipelineStage({ status: 'pending_approval', hasDemo: true, history: [] }), 3);
  assert.equal(resolveAiPipelineStage({ status: 'processing', hasDemo: true, history: [{ action: 'approve_framework' }] }), 4);
  assert.equal(resolveAiPipelineStage({ status: 'reviewing', hasDemo: true, hasFinal: true, history: [{ action: 'approve_framework' }] }), 5);
  assert.equal(resolveAiPipelineStage({ status: 'processing', hasDemo: false, history: [] }), 1);
});

test('formal leader detection supports production and UAT leader identities', () => {
  assert.equal(isFormalLeader({ enName: 'judyzzhang' }), true);
  assert.equal(isFormalLeader({ enName: 'uat.leader', account_type: 'uat_leader', role: 'leader' }), true);
  assert.equal(isFormalLeader({ enName: 'uat.requester', account_type: 'uat_requester', role: 'requester' }), false);
});
