import assert from 'node:assert/strict';
import test from 'node:test';
import * as orchestrator from '../js/seedream-demo-orchestrator-v5.js';

test('generation controller mounts only into the explicit control host', () => {
  assert.equal(typeof orchestrator.findGenerationControlHost, 'function');
  const controlHost = { id:'control-host' };
  const root = {
    querySelector(selector) {
      assert.equal(selector, '[data-generation-control]');
      return controlHost;
    },
  };
  assert.equal(orchestrator.findGenerationControlHost(root), controlHost);
});

test('completed generation control shows progress without rendering Demo or Drive images', () => {
  assert.equal(typeof orchestrator.renderGenerationControlHtml, 'function', 'generation-control renderer must be exported');
  const html = orchestrator.renderGenerationControlHtml({
    rows:[
      { id:'p1', page_index:1, status:'ready', output:{} },
      { id:'p2', page_index:2, status:'ready', output:{} },
      { id:'p3', page_index:3, status:'ready', output:{} },
    ],
    pageCount:3,
  });
  assert.match(html, /第 1 页已完成/);
  assert.match(html, /第 3 页已完成/);
  assert.doesNotMatch(html, /<img|Google Drive|打开云盘|Seedream Demo|Demo 0[123]/);
});

test('failed generation control keeps retry action without technical archive details', () => {
  assert.equal(typeof orchestrator.renderGenerationControlHtml, 'function', 'generation-control renderer must be exported');
  const html = orchestrator.renderGenerationControlHtml({
    rows:[{ id:'p2', page_index:2, status:'failed', error_message:'GOOGLE_DRIVE_ARCHIVE_FAILED', output:{ provider_generated:true, failure_stage:'drive_archive' } }],
    pageCount:3,
  });
  assert.match(html, /重试保存结果/);
  assert.match(html, /demoArchiveBtnV5/);
  assert.doesNotMatch(html, /Google Drive|GOOGLE_DRIVE|云盘|<img/);
});
