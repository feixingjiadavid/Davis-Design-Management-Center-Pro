import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFormalRequesterMessageContents, toFormalAiMessage } from './formal-ai-message.mjs';

test('maps AI and requester conversation into the formal message shape', () => {
  assert.deepEqual(toFormalAiMessage({ id: 'm1', taskId: 'TK-1', senderRole: 'ai_designer', content: '请确认尺寸' }), {
    id: 'm1', task_id: 'TK-1', sender_type: 'ai', content: '请确认尺寸', status: 'sent',
  });
  assert.equal(toFormalAiMessage({ id: 'm2', taskId: 'TK-1', senderRole: 'requester', content: '1242×1660' }).sender_type, 'requester');
});

test('excludes system events and empty content from requester communication', () => {
  assert.equal(toFormalAiMessage({ id: 'm1', taskId: 'TK-1', senderRole: 'system', content: 'retry' }), null);
  assert.equal(toFormalAiMessage({ id: 'm1', taskId: 'TK-1', senderRole: 'ai_designer', content: '  ' }), null);
});

test('keeps every answer and supplemental message in combined requester input', () => {
  assert.deepEqual(buildFormalRequesterMessageContents([{ answer:'尺寸 1242×1660' }, { answer:'周五交付' }], '另外请保持蓝色'), {
    answers:['尺寸 1242×1660', '周五交付'],
    supplemental:'另外请保持蓝色',
  });
});
