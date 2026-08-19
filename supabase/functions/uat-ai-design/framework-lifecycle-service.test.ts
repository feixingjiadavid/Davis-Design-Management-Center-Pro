import assert from 'node:assert/strict';
import { createFakeAdmin } from './test-support.ts';
import { approveFramework, rejectFramework } from './framework-lifecycle-service.ts';

const actor = { id: '11111111-1111-1111-1111-111111111111', label: 'UAT领导' };

function seed() {
  return {
    test_tasks: [{
      id: 'T1',
      status: 'pending_approval',
      history_json: JSON.stringify([{ action: 'submit_framework', version: 'v-2', ai_analysis_id: 'a1', ai_demo_generation_ids: ['g1', 'g2', 'g3'] }]),
    }],
    uat_framework_templates: [],
    uat_design_generations: [1, 2, 3].map((page) => ({
      id: `g${page}`,
      task_id: 'T1',
      analysis_id: 'a1',
      page_index: page,
      status: 'ready',
      output: {
        page_title: ['封面', '规则', '补充'][page - 1],
        drive_file_id: `d${page}`,
        drive_url: `u${page}`,
        exact_copy: [`C${page}`],
        size: { width: 1242, height: 1660 },
      },
    })),
  };
}

Deno.test('reject creates no generation', async () => {
  const admin = createFakeAdmin(seed());
  await rejectFramework(admin, 'T1', actor, '方向不合适');
  assert.equal(admin.rows('test_tasks')[0].status, 'rejected');
  assert.equal(admin.countInserts('uat_design_generations'), 0);
  assert.equal(JSON.parse(admin.rows('test_tasks')[0].history_json).at(-1).action, 'reject_framework');
});

Deno.test('approve freezes exact submitted pages and moves reviewing with no generation', async () => {
  const admin = createFakeAdmin(seed());
  const result = await approveFramework(admin, 'T1', actor, '确认');
  assert.equal(result.task.status, 'reviewing');
  assert.equal(result.template.pages.length, 3);
  assert.deepEqual(result.template.pages.map((page: any) => page.drive_file_id), ['d1', 'd2', 'd3']);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('cannot approve already templated task', async () => {
  const data = seed();
  data.uat_framework_templates = [{ id: 't1', task_id: 'T1' }] as any;
  const admin = createFakeAdmin(data);
  await assert.rejects(() => approveFramework(admin, 'T1', actor), /FRAMEWORK_TEMPLATE_ALREADY_LOCKED/);
});
