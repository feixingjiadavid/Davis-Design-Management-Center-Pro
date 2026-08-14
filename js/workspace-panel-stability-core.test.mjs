import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStablePanelSignature } from './workspace-panel-stability-core.js';

test('stable panel signature ignores image payload but changes when meaningful data changes', () => {
  const base = {
    taskId: 'TK-0001',
    task: { status: 'processing', summary_desc: '理解中' },
    references: [{ id: 'r1', updated_at: 't1', is_primary: true, file_name: 'a.jpg', note: '', data_url: 'data:image/jpeg;base64,AAA' }],
    assets: [{ id: 'a1', updated_at: 't1', asset_role: 'TIG IP', file_name: 'ip.png', note: '', data_url: 'data:image/png;base64,BBB' }],
    demos: [{ id: 'd1', page_index: 1, status: 'generating', updated_at: 't1' }],
    analysis: { version: 9, status: 'understanding_ready' },
  };
  const sameVisualsDifferentPayload = structuredClone(base);
  sameVisualsDifferentPayload.references[0].data_url = 'data:image/jpeg;base64,CHANGED_PAYLOAD';
  sameVisualsDifferentPayload.assets[0].data_url = 'data:image/png;base64,CHANGED_PAYLOAD';
  assert.equal(buildStablePanelSignature(base), buildStablePanelSignature(sameVisualsDifferentPayload));

  const changed = structuredClone(base);
  changed.references[0].is_primary = false;
  assert.notEqual(buildStablePanelSignature(base), buildStablePanelSignature(changed));
});
