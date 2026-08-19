import assert from 'node:assert/strict';
import { createFakeAdmin } from './test-support.ts';
import { queueContentRevision } from './content-revision-service.ts';

Deno.test('repeated content revision queue request reuses active generation rows', async () => {
  const admin = createFakeAdmin({
    test_tasks: [{ id: 'T1', status: 'processing', history_json: '[]' }],
    uat_framework_templates: [{ id: 'tpl', task_id: 'T1', page_count: 3, pages: [] }],
    uat_content_revisions: [{
      id: 'r1', task_id: 'T1', template_id: 'tpl', analysis_id: 'a1', revision_no: 1,
      status: 'generating', affected_pages: [2], source_mode: 'system_text',
    }],
    uat_design_generations: [{
      id: 'g1', task_id: 'T1', revision_id: 'r1', page_index: 2, status: 'queued',
      generation_mode: 'content_revision',
    }],
  });

  const result = await queueContentRevision(admin, 'T1', 'r1', 'same-run');
  assert.equal(result.idempotent, true);
  assert.equal(result.generations.length, 1);
  assert.equal(result.generations[0].id, 'g1');
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});
