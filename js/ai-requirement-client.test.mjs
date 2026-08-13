import assert from 'node:assert/strict';
import test from 'node:test';
import { selectActiveSources, selectCurrentAnalysis } from './ai-requirement-client.js';

test('shows only the Tencent source matching the task current link', () => {
  const sources = [
    { id: 'form', source_type: 'form_fields', source_url: null },
    { id: 'old', source_type: 'tencent_doc', source_url: 'https://docs.qq.com/doc/old', status: 'failed' },
    { id: 'current', source_type: 'tencent_doc', source_url: 'https://docs.qq.com/doc/current', status: 'ready' },
  ];
  assert.deepEqual(
    selectActiveSources(sources, 'https://docs.qq.com/doc/current').map(source => source.id),
    ['form', 'current'],
  );
});

test('does not display a stale requirement analysis', () => {
  assert.equal(selectCurrentAnalysis([{ id: 'old-analysis', status: 'stale' }]), null);
  assert.equal(selectCurrentAnalysis([{ id: 'new-analysis', status: 'understanding_ready' }])?.id, 'new-analysis');
});
