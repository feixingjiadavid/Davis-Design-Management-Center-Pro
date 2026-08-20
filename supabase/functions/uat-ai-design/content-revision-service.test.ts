import assert from 'node:assert/strict';
import { createFakeAdmin } from './test-support.ts';
import { prepareContentRevision, sha256Text } from './content-revision-service.ts';

const templatePages = [
  { page_index: 1, page_title: '封面', exact_copy: ['A'], drive_file_id: 'd1' },
  { page_index: 2, page_title: '规则', exact_copy: ['B'], drive_file_id: 'd2' },
  { page_index: 3, page_title: '补充', exact_copy: ['C'], drive_file_id: 'd3' },
];

async function seed(status = 'reviewing') {
  const hash = await sha256Text('base');
  return {
    test_tasks: [{ id: 'T1', status, full_desc: 'x', link: 'doc' }],
    uat_framework_templates: [{ id: 'tpl', task_id: 'T1', source_content_hash: hash, page_count: 3, pages: templatePages }],
    uat_content_revisions: [],
    uat_requirement_sources: [{ id: 's1', task_id: 'T1', source_type: 'tencent_doc', source_url: 'doc', status: 'ready', current_snapshot_id: 'ss1', updated_at: '2026-01-01' }],
    uat_source_snapshots: [{ id: 'ss1', content_sha256: hash }],
    uat_design_generations: [],
  };
}

const analyzePages = (pages: any[]) => async () => ({ id: 'a2', status: 'understanding_ready', brief: { pages } });

Deno.test('P2-only copy change creates content_ready with affected [2]', async () => {
  const admin = createFakeAdmin(await seed());
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'change' }, {
    analyze: analyzePages([
      { index: 1, title: 'whatever', copy: ['A'] },
      { index: 2, title: 'whatever', copy: ['B2'] },
      { index: 3, title: 'whatever', copy: ['C'] },
    ]),
  });
  assert.equal(result.status, 'content_ready');
  assert.deepEqual(result.affected_pages, [2]);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('explicit P2 requester feedback overrides broader AI diff pages', async () => {
  const admin = createFakeAdmin(await seed());
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'P2出现文字乱码，需要纠正' }, {
    analyze: analyzePages([
      { index: 1, title: 'whatever', copy: ['A2'] },
      { index: 2, title: 'whatever', copy: ['B2'] },
      { index: 3, title: 'whatever', copy: ['C'] },
    ]),
  });
  assert.equal(result.status, 'content_ready');
  assert.deepEqual(result.affected_pages, [2]);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('explicit P2 and P3 requester feedback targets exactly [2,3]', async () => {
  const admin = createFakeAdmin(await seed());
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'P2出现文字乱码，需要纠正；P3奖励金额改成8000元豆' }, {
    analyze: analyzePages([
      { index: 1, title: 'whatever', copy: ['A2'] },
      { index: 2, title: 'whatever', copy: ['B2'] },
      { index: 3, title: 'whatever', copy: ['C2'] },
    ]),
  });
  assert.equal(result.status, 'content_ready');
  assert.deepEqual(result.affected_pages, [2, 3]);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('locked template allows requester content revision from rejected task', async () => {
  const admin = createFakeAdmin(await seed('rejected'));
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'P2出现文字乱码，需要纠正' }, {
    analyze: analyzePages([
      { index: 1, title: 'whatever', copy: ['A'] },
      { index: 2, title: 'whatever', copy: ['B2'] },
      { index: 3, title: 'whatever', copy: ['C'] },
    ]),
  });
  assert.equal(result.status, 'content_ready');
  assert.deepEqual(result.affected_pages, [2]);
});

Deno.test('page count change is capacity_conflict with zero generation', async () => {
  const admin = createFakeAdmin(await seed());
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'change' }, {
    analyze: analyzePages([{ index: 1, title: 'x', copy: ['A'] }, { index: 2, title: 'x', copy: ['B'] }]),
  });
  assert.equal(result.status, 'capacity_conflict');
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('capacity growth beyond deterministic limit conflicts', async () => {
  const admin = createFakeAdmin(await seed());
  const huge = 'Z'.repeat(200);
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'change' }, {
    analyze: analyzePages([
      { index: 1, title: 'x', copy: [huge] },
      { index: 2, title: 'x', copy: ['B'] },
      { index: 3, title: 'x', copy: ['C'] },
    ]),
  });
  assert.equal(result.status, 'capacity_conflict');
});

Deno.test('identical mapped copy returns no_change without revision or generation', async () => {
  const admin = createFakeAdmin(await seed());
  const result = await prepareContentRevision(admin, 'T1', 'u1', { source_mode: 'system_text', system_content: 'change' }, {
    analyze: analyzePages([
      { index: 1, title: 'x', copy: ['A'] },
      { index: 2, title: 'x', copy: ['B'] },
      { index: 3, title: 'x', copy: ['C'] },
    ]),
  });
  assert.equal(result.status, 'no_change');
  assert.equal(admin.countInserts('uat_content_revisions'), 0);
  assert.equal(admin.countInserts('uat_design_generations'), 0);
});

Deno.test('source hashes are deterministic across line endings', async () => {
  assert.equal(await sha256Text('a\r\nb'), await sha256Text('a\nb'));
});
