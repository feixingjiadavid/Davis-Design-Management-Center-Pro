import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeFunctionForAction, selectActiveSources, selectCurrentAnalysis, selectCurrentClarifications } from './ai-requirement-client.js';

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

test('does not display clarification questions from a stale analysis', () => {
  const questions = [{ id: 'old-question', analysis_id: 'old-analysis', status: 'open' }];
  assert.deepEqual(selectCurrentClarifications(questions, null), []);
  assert.deepEqual(selectCurrentClarifications(questions, { id: 'new-analysis' }), []);
});

test('routes paid Seedream final generation through dedicated secure function', () => {
  assert.equal(edgeFunctionForAction('generate_final'), 'uat-seedream-final');
  assert.equal(edgeFunctionForAction('generate_demo'), 'uat-ai-design');
  assert.equal(edgeFunctionForAction('auto_analyze'), 'uat-ai-design');
});
