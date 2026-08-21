import assert from 'node:assert/strict';

const core = await import('../js/requester-version-timeline-core.mjs').catch(() => ({}));

assert.equal(typeof core.buildRequesterVersionTimeline, 'function', '正式版本时间线构建器必须存在');
assert.equal(typeof core.renderRequesterVersionTimelineMarkup, 'function', '需求方版本展示渲染器必须存在');

const task = {
  status: 'reviewing',
  history_json: JSON.stringify([
    {
      action: 'submit_framework',
      version: 'v-2',
      drive_file_ids: ['demo-1', 'demo-2', 'demo-3'],
      ai_tools: ['Seedream 4.0'],
      source_link: 'https://drive.google.com/demo',
    },
    { action: 'approve_framework', version: 'v-2', reply: '方向通过' },
  ]),
};
const template = {
  id: 'template-1',
  framework_version: 'v-2',
  approved_by_label: '设计负责人',
  approved_at: '2026-08-20T08:00:00.000Z',
  approval_note: '方向通过',
  page_count: 3,
  pages: [
    { page_index: 1, drive_file_id: 'template-1', drive_url: 'https://drive.google.com/t1', model: 'Seedream 4.0' },
    { page_index: 2, drive_file_id: 'template-2', drive_url: 'https://drive.google.com/t2' },
    { page_index: 3, drive_file_id: 'template-3', drive_url: 'https://drive.google.com/t3' },
  ],
};
const revisions = [
  { id: 'revision-1', revision_no: 1, status: 'superseded', page_manifest: [{ page_index: 1, drive_file_id: 'r1-1' }] },
  { id: 'revision-2', revision_no: 2, status: 'ready_for_review', page_manifest: [{ page_index: 1, drive_file_id: 'r2-1' }] },
  { id: 'revision-3', revision_no: 3, status: 'generating', page_manifest: [{ page_index: 1, drive_file_id: 'attempt-3' }] },
  { id: 'revision-4', revision_no: 4, status: 'failed', page_manifest: [{ page_index: 1, drive_file_id: 'failed-4' }] },
];

const timeline = core.buildRequesterVersionTimeline({ task, template, revisions });
assert.deepEqual(
  timeline.map((stage) => stage.label),
  ['Demo 框架版', '领导审核状态', '第 1 次修改版', '第 2 次修改版', '当前版本'],
);
assert.deepEqual(
  timeline.filter((stage) => stage.kind === 'revision').map((stage) => stage.revisionNo),
  [1, 2],
  '生成中和失败的尝试不得进入正式交付时间线',
);
assert.equal(timeline.at(-1).sourceLabel, '第 2 次修改版');

const markup = core.renderRequesterVersionTimelineMarkup(timeline);
for (const forbidden of ['Seedream', 'Google Drive', 'drive.google.com', 'Prompt', 'retry', 'failed', 'debug', 'attempt-3', 'failed-4']) {
  assert.equal(markup.includes(forbidden), false, `需求方 HTML 不得包含后台字段：${forbidden}`);
}
assert.match(markup, /点击图片查看大图/);

const pendingTimeline = core.buildRequesterVersionTimeline({
  task: {
    status: 'pending_approval',
    history_json: JSON.stringify([{ action: 'submit_framework', version: 'v-1', drive_file_ids: ['d1', 'd2', 'd3'] }]),
  },
  template: null,
  revisions: [],
});
assert.deepEqual(pendingTimeline.map((stage) => stage.label), ['Demo 框架版', '领导审核状态']);
assert.equal(pendingTimeline[1].statusText, '待领导审核');
assert.equal(pendingTimeline[1].tone, 'pending');

const laterDeliveredTimeline = core.buildRequesterVersionTimeline({
  task,
  template,
  revisions: [
    ...revisions,
    { id: 'revision-3-delivered', revision_no: 3, status: 'accepted', page_manifest: [{ page_index: 1, drive_file_id: 'r3-current' }] },
  ],
});
assert.deepEqual(
  laterDeliveredTimeline.filter((stage) => stage.kind === 'revision').map((stage) => stage.revisionNo),
  [1, 2],
  '正式时间线仍只列出规定的两轮修改',
);
assert.equal(laterDeliveredTimeline.at(-1).sourceLabel, '第 3 次修改版');
assert.equal(laterDeliveredTimeline.at(-1).pages[0].fileId, 'r3-current');

const rejectedTimeline = core.buildRequesterVersionTimeline({
  task: {
    status: 'rejected',
    history_json: JSON.stringify([
      { action: 'submit_framework', version: 'v-1', drive_file_ids: ['d1'] },
      { action: 'reject_framework', reply: '请调整方向' },
    ]),
  },
  template: null,
  revisions: [],
});
assert.equal(rejectedTimeline[1].tone, 'rejected');
assert.match(core.renderRequesterVersionTimelineMarkup(rejectedTimeline), /border-rose-500/);
assert.equal(timeline[1].tone, 'approved');

console.log('requester version timeline core tests passed');
