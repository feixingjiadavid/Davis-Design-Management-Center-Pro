import assert from 'node:assert/strict';
import test from 'node:test';
import * as historyModule from '../js/all-generation-results-v1.js';

test('design history orders formal versions by created_at descending and keeps every page', () => {
  assert.equal(typeof historyModule.buildDesignHistory, 'function', 'version-history builder must be exported');

  const versions = [
    { id:'v10', version_no:10, version_name:'较早版本', created_at:'2026-08-20T08:00:00Z' },
    { id:'v2', version_no:2, version_name:'最新修改', created_at:'2026-08-21T08:00:00Z' },
    { id:'v1', version_no:1, version_name:'框架方案', created_at:'2026-08-19T08:00:00Z' },
  ];
  const assets = [
    { id:'a3', design_version_id:'v2', asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v2/p3.png', sort_order:3 },
    { id:'a1', design_version_id:'v2', asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v2/p1.png', sort_order:1 },
    { id:'a2', design_version_id:'v2', asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v2/p2.png', sort_order:2 },
    { id:'f1', design_version_id:'v1', asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v1/p1.png', sort_order:1 },
  ];

  const result = historyModule.buildDesignHistory(versions, assets);

  assert.deepEqual(result.map((version) => version.id), ['v2', 'v10', 'v1']);
  assert.deepEqual(result[0].assets.map((asset) => asset.id), ['a1', 'a2', 'a3']);
});

test('version history HTML uses direct formal asset URLs and internal preview controls', () => {
  assert.equal(typeof historyModule.renderDesignHistoryHtml, 'function', 'version-history renderer must be exported');

  const html = historyModule.renderDesignHistoryHtml([{
    id:'v3', version_no:3, version_name:'第二次修改', status:'pending_review', description:'调整标题层级', created_at:'2026-08-21T08:00:00Z',
    assets:[
      { asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v3/p1.png', sort_order:1 },
      { asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v3/p2.png', sort_order:2 },
      { asset_url:'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v3/p3.png', sort_order:3 },
    ],
  }]);

  assert.match(html, /v3 第二次修改/);
  assert.match(html, /P1/);
  assert.match(html, /P2/);
  assert.match(html, /P3/);
  assert.match(html, /data-design-history-preview=/);
  assert.doesNotMatch(html, /Seedream|Google Drive|history_json|drive_url|run_id/);
});

test('click preview controller opens and closes an in-system high-resolution modal', () => {
  assert.equal(typeof historyModule.openDesignHistoryPreview, 'function', 'preview opener must be exported');
  assert.equal(typeof historyModule.closeDesignHistoryPreview, 'function', 'preview closer must be exported');
  const classes = new Set(['hidden']);
  const image = { src:'', removeAttribute(name) { if (name === 'src') this.src = ''; } };
  const modal = {
    classList:{ add:(name)=>classes.add(name), remove:(name)=>classes.delete(name) },
    querySelector:()=>image,
  };
  globalThis.document = {
    body:{ style:{} },
    getElementById:()=>modal,
  };
  const url = 'https://example.supabase.co/storage/v1/object/public/designs/TK-0001/v3/p1.png';

  historyModule.openDesignHistoryPreview(url);
  assert.equal(image.src, url);
  assert.equal(classes.has('hidden'), false);
  assert.equal(classes.has('flex'), true);
  assert.equal(document.body.style.overflow, 'hidden');

  historyModule.closeDesignHistoryPreview();
  assert.equal(image.src, '');
  assert.equal(classes.has('hidden'), true);
  assert.equal(classes.has('flex'), false);
  assert.equal(document.body.style.overflow, '');
});

test('generation stage history groups every page into Creative Draft, Composer Preview, and Final Output', () => {
  assert.equal(typeof historyModule.buildGenerationStageHistory, 'function');
  const batches = historyModule.buildGenerationStageHistory(
    [
      { id:'g1', analysis_id:'batch-1', generation_mode:'initial_framework', page_index:1, created_at:'2026-08-20T08:00:00Z', status:'ready' },
      { id:'g2', analysis_id:'batch-1', generation_mode:'initial_framework', page_index:2, created_at:'2026-08-20T08:01:00Z', status:'ready' },
    ],
    [
      { id:'raw1', generation_id:'g1', page_index:1, asset_role:'raw_creative', asset_url:'private-raw', storage_bucket:'ai-generation-assets' },
      { id:'preview1', generation_id:'g1', page_index:1, asset_role:'composer_preview', asset_url:'private-preview', storage_bucket:'ai-generation-assets' },
      { id:'final1', generation_id:'g1', page_index:1, asset_role:'branded_output', asset_url:'public-final', storage_bucket:'designs' },
      { id:'raw2', generation_id:'g2', page_index:2, asset_role:'raw_creative', asset_url:'private-raw-2', storage_bucket:'ai-generation-assets' },
    ],
    [{ generation_id:'g1', status:'passed', vi_check:{ passed:true, summary:{ logo:'PASS', position:'PASS', color:'PASS' } } }],
    new Map([['raw1','signed-raw'],['preview1','signed-preview'],['raw2','signed-raw-2']]),
  );
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].pages.map((page) => page.pageNo), [1, 2]);
  assert.deepEqual(batches[0].pages[0].stages.map((stage) => stage.label), ['Creative Draft', 'Composer Preview', 'Final Output']);
  assert.equal(batches[0].pages[0].stages[0].url, 'signed-raw');
  assert.equal(batches[0].pages[0].viSummary.logo, 'PASS');
});

test('stage renderer stays inside design history and exposes no Drive or technical run fields', () => {
  assert.equal(typeof historyModule.renderGenerationStageHtml, 'function');
  const html = historyModule.renderGenerationStageHtml([{
    key:'batch', versionLabel:'v1 框架方案', created_at:'2026-08-20T08:00:00Z',
    pages:[{ pageNo:1, status:'passed', viSummary:{ logo:'PASS', position:'PASS', color:'PASS' }, stages:[
      { role:'raw_creative', label:'Creative Draft', url:'signed-raw' },
      { role:'composer_preview', label:'Composer Preview', url:'signed-preview' },
      { role:'branded_output', label:'Final Output', url:'public-final' },
    ] }],
  }]);
  assert.match(html, /Creative Draft/);
  assert.match(html, /Composer Preview/);
  assert.match(html, /Final Output/);
  assert.match(html, /Logo:.*PASS/);
  assert.doesNotMatch(html, /Seedream Demo|Google Drive|run id|run_id|prompt|模型/);
});
