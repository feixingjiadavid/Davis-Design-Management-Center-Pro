import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildFormalVersionPublication,
  formalAssetStoragePath,
} from './formal-version-publisher.mjs';

const storageUrl = (page) => `https://project.supabase.co/storage/v1/object/public/designs/formal-deliveries/TK-1/g-${page}/p-${page}.png`;
const row = (page, status = 'ready', assetUrl = storageUrl(page)) => ({
  id: `g-${page}`,
  page_index: page,
  page_count: 3,
  status,
  formal_asset: {
    id: `branded-${page}`,
    asset_url: assetUrl,
    asset_role: 'branded_output',
    storage_bucket: 'designs',
    composition_status: 'passed',
    vi_passed: true,
  },
});

test('publishes one v1 framework only when every page is ready', () => {
  const publication = buildFormalVersionPublication({
    taskId: 'TK-1',
    mode: 'initial_framework',
    rows: [row(3), row(1), row(2)],
    creator: 'Davis AI设计师',
  });
  assert.deepEqual(publication.version, {
    task_id: 'TK-1',
    version_no: 1,
    version_name: '框架方案',
    version_type: 'framework',
    status: 'pending_review',
    description: 'AI 设计师已完成框架方案，提交领导审核。',
    creator: 'Davis AI设计师',
  });
  assert.deepEqual(publication.assets.map(({ sort_order }) => sort_order), [1, 2, 3]);
  assert.deepEqual(publication.assets.map(({ asset_url }) => asset_url), [storageUrl(1), storageUrl(2), storageUrl(3)]);
  assert.deepEqual(publication.assets.map(({ source_generation_asset_id }) => source_generation_asset_id), ['branded-1', 'branded-2', 'branded-3']);
});

test('maps content revision one to v2 and preserves formal modification meaning', () => {
  const publication = buildFormalVersionPublication({
    taskId: 'TK-1',
    mode: 'content_revision',
    revisionNo: 1,
    description: '更新活动日期与报名二维码',
    rows: [row(1), row(2), row(3)],
  });
  assert.equal(publication.version.version_no, 2);
  assert.equal(publication.version.version_name, '第一次修改');
  assert.equal(publication.version.version_type, 'revision');
  assert.equal(publication.version.status, 'pending_review');
  assert.equal(publication.version.description, '更新活动日期与报名二维码');
});

test('builds a complete revision version by overlaying changed pages on the prior formal version', () => {
  const publication = buildFormalVersionPublication({
    taskId: 'TK-1',
    mode: 'content_revision',
    revisionNo: 1,
    rows: [{ ...row(2), page_count: 3 }],
    baseAssets: [1, 2, 3].map((page) => ({ sort_order: page, asset_url: storageUrl(page), source_generation_asset_id: `branded-${page}` })),
  });
  assert.ok(publication);
  assert.equal(publication.assets.length, 3);
  assert.equal(publication.assets[0].asset_url, storageUrl(1));
  assert.equal(publication.assets[1].asset_url, storageUrl(2));
  assert.equal(publication.assets[2].asset_url, storageUrl(3));
});

test('does not publish partial, failed, duplicated, or non-Storage results', () => {
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), row(2)] }), null);
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), row(2, 'failed'), row(3)] }), null);
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), row(1), row(3)] }), null);
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), row(2), row(3, 'ready', 'https://drive.google.com/file/d/3')] }), null);
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), { ...row(2), formal_asset: { ...row(2).formal_asset, asset_role: 'raw_creative' } }, row(3)] }), null);
  assert.equal(buildFormalVersionPublication({ taskId: 'TK-1', mode: 'framework', rows: [row(1), { ...row(2), formal_asset: { ...row(2).formal_asset, composition_status: 'failed', vi_passed: false } }, row(3)] }), null);
});

test('builds deterministic Supabase Storage object paths without technical URLs', () => {
  assert.equal(
    formalAssetStoragePath({ taskId: 'TK 01/unsafe', generationId: 'abc-123', pageIndex: 2, extension: 'jpeg' }),
    'formal-deliveries/TK-01-unsafe/abc-123/p-2.jpg',
  );
});

test('worker publishes formal versions without writing generation delivery into history_json', () => {
  const source = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /history_json/);
  assert.match(source, /from\('design_versions'\)/);
  assert.match(source, /from\('design_version_assets'\)/);
  assert.match(source, /from\('ai_generation_assets'\)/);
  assert.match(source, /from\('brand_composition_runs'\)/);
  assert.doesNotMatch(source, /output\?\.formal_asset_url|output\.formal_asset_url/);
  assert.doesNotMatch(source, /GOOGLE_DRIVE_ARCHIVE_FAILED/);
  assert.match(source, /eq\('generation_id',row\.id\)\.eq\('status','passed'\)/);
});
