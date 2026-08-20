import assert from 'node:assert/strict';
let mod = null;
try { mod = await import('./revision-clarification-context.mjs'); } catch {}
assert.equal(typeof mod?.buildRevisionInstruction, 'function');
const text = mod.buildRevisionInstruction({
  originalFeedback: 'P2 出现文字乱码，需要纠正；P3 奖励金额改成 8000 元豆。',
  clarifications: [{ question: 'P3 奖励金额具体改哪里？', answer: '不用改这个' }],
  messages: ['请将P3虎IP右边，旗帜下方的文化大使改为科技讲师'],
});
assert.match(text, /原始修改意见/);
assert.match(text, /不用改这个/);
assert.match(text, /科技讲师/);
assert.match(text, /后续回答与补充.*覆盖.*冲突/);
console.log('revision clarification context: 5/5 passed');