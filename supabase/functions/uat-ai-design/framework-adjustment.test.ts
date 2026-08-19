import assert from 'node:assert/strict';
import { createFakeAdmin } from './test-support.ts';
import { generateFrameworkRevision } from './framework-adjustment-service.ts';

const base = {
  test_tasks: [{
    id: 'T1',
    status: 'rejected',
    full_desc: '原始内容',
    history_json: JSON.stringify([
      { action: 'submit_framework', version: 'v-1' },
      { action: 'reject_framework', version: 'v-1', reply: '不合适' },
    ]),
  }],
  uat_framework_adjustments: [],
  uat_design_generations: [],
};

const deps = {
  analyze: async () => ({
    id: 'a2',
    status: 'understanding_ready',
    brief: { pages: [{ index: 1, title: 'P1', copy: ['A'] }, { index: 2, title: 'P2', copy: ['B'] }] },
  }),
  confirmAnalysis: async () => ({}),
  refreshSources: async () => ({}),
};

Deno.test('empty requester direction is rejected', async () => {
  const admin = createFakeAdmin(base);
  await assert.rejects(() => generateFrameworkRevision(admin, 'T1', 'u1', { idempotency_key: 'k' }, deps), /REQUESTER_DIRECTION_REQUIRED/);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('wrong task state is rejected', async () => {
  const seed = structuredClone(base);
  seed.test_tasks[0].status = 'processing';
  const admin = createFakeAdmin(seed);
  await assert.rejects(() => generateFrameworkRevision(admin, 'T1', 'u1', { requester_direction: '改方向', idempotency_key: 'k' }, deps), /FRAMEWORK_NOT_WAITING_REQUESTER_DIRECTION/);
});

Deno.test('missing idempotency key is rejected', async () => {
  const admin = createFakeAdmin(base);
  await assert.rejects(() => generateFrameworkRevision(admin, 'T1', 'u1', { requester_direction: '改方向' }, deps), /IDEMPOTENCY_KEY_REQUIRED/);
});

Deno.test('valid submission stores one adjustment and queues one page row per page', async () => {
  const admin = createFakeAdmin(base);
  const result = await generateFrameworkRevision(admin, 'T1', 'u1', { requester_direction: '改成更简洁', idempotency_key: 'run1' }, deps);
  assert.equal(admin.countInserts('uat_framework_adjustments'), 1);
  assert.equal(admin.countInserts('uat_design_generations'), 2);
  assert.equal(result.generations[0].generation_mode, 'framework_revision');
  assert.equal(admin.rows('test_tasks')[0].status, 'processing');
});

Deno.test('clarification path creates zero generation', async () => {
  const admin = createFakeAdmin(base);
  const localDeps = { ...deps, analyze: async () => ({ id: 'a2', status: 'clarification_required', brief: { pages: [] } }) };
  const result = await generateFrameworkRevision(admin, 'T1', 'u1', { requester_direction: '改', idempotency_key: 'run1' }, localDeps);
  assert.equal(result.status, 'needs_input');
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});
