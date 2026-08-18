import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSeedreamDemoProgress, DEMO_MODEL, DEMO_PROMPT_VERSION } from './seedream-demo-recovery.js';

const now = Date.parse('2026-08-14T10:41:00Z');
const row = (page, status, extra={}) => ({
  id:`g${page}`,
  kind:'demo',
  model:DEMO_MODEL,
  prompt_version:DEMO_PROMPT_VERSION,
  page_index:page,
  page_count:3,
  status,
  created_at:`2026-08-14T10:40:0${page}Z`,
  ...extra,
});

test('reports real page 1 of 3 while first Seedream page is generating', () => {
  const p = deriveSeedreamDemoProgress({status:'generating_demo'}, [row(1,'generating')], now);
  assert.equal(p.state,'generating');
  assert.equal(p.currentPage,1);
  assert.equal(p.totalPages,3);
  assert.equal(p.completedPages,0);
  assert.ok(p.elapsedSeconds > 0);
});

test('advances to page 2 after page 1 is ready', () => {
  const p = deriveSeedreamDemoProgress({status:'generating_demo'}, [row(1,'ready'),row(2,'generating')], now);
  assert.equal(p.currentPage,2);
  assert.equal(p.completedPages,1);
});

test('surfaces an actual current provider failure and allows manual retry', () => {
  const p = deriveSeedreamDemoProgress({status:'demo_failed'}, [row(1,'failed',{error_message:'SEEDREAM_HTTP_400:InvalidParameter'})], now);
  assert.equal(p.state,'failed');
  assert.match(p.error,/InvalidParameter/);
  assert.equal(p.canRetry,true);
});

test('a repaired task with no current failed Seedream rows is ready to start', () => {
  const p = deriveSeedreamDemoProgress({status:'demo_failed',summary_desc:'历史失败已修复'}, [], now);
  assert.equal(p.currentRows.length,0);
  assert.equal(p.state,'queued');
  assert.equal(p.error,'');
});

test('ready_for_demo is queued for explicit manual generation', () => {
  const p = deriveSeedreamDemoProgress({status:'ready_for_demo'}, [], now);
  assert.equal(p.state,'queued');
});

test('ignores legacy Cloudflare Demo rows completely', () => {
  const legacy = {kind:'demo',model:'@cf/black-forest-labs/flux-2-klein-9b',prompt_version:'old',page_index:1,page_count:3,status:'ready',created_at:'2026-08-14T09:00:00Z'};
  const p = deriveSeedreamDemoProgress({status:'ready_for_demo'}, [legacy], now);
  assert.equal(p.currentRows.length,0);
  assert.equal(p.state,'queued');
});