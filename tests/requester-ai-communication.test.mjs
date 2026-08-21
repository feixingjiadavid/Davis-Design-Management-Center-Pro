import assert from 'node:assert/strict';
import { loadAiCommunicationState } from '../js/ai-requirement-client.js';

const queriedTables = [];
const rowsByTable = {
  task_ai_messages: [
    { id: 'question-1', sender_type: 'ai', content: '请补充尺寸', status: 'open' },
    { id: 'message-1', sender_type: 'requester', content: '1242×1660', status: 'sent' },
  ],
};
const fakeSupabase = {
  from(table) {
    queriedTables.push(table);
    const chain = {
      select() { return chain; },
      eq() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      then(resolve, reject) {
        return Promise.resolve({ data: rowsByTable[table] || [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  },
};

const communication = await loadAiCommunicationState(fakeSupabase, 'TK-001');
assert.equal(communication.analysis, null);
assert.equal(communication.clarifications.length, 1);
assert.equal(communication.clarifications[0].question, '请补充尺寸');
assert.equal(communication.messages.length, 2);
assert.deepEqual(
  queriedTables.sort(),
  ['task_ai_messages'],
  '需求方沟通区只能读取正式沟通表',
);

console.log('requester AI communication tests passed');
