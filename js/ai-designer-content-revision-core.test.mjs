import assert from 'node:assert/strict';
import { latestRequesterRevisionFeedback, selectAiDesignerRevisionMode } from './ai-designer-content-revision-core.mjs';

const history = [
  { action:'approve_framework', reply:'确认方向无误' },
  { action:'reject_draft', reply:'P2 出现文字乱码，需要纠正；P3 奖励金额改成 8000 元豆。' },
];

assert.equal(latestRequesterRevisionFeedback(history)?.feedback, 'P2 出现文字乱码，需要纠正；P3 奖励金额改成 8000 元豆。');
assert.equal(selectAiDesignerRevisionMode({ template:{id:'t1'}, revision:null, task:{status:'rejected'}, history }).kind, 'needs_analysis');
assert.equal(selectAiDesignerRevisionMode({ template:{id:'t1'}, revision:{status:'content_ready'}, task:{status:'reviewing'}, history }).kind, 'ready_to_generate');
assert.equal(selectAiDesignerRevisionMode({ template:{id:'t1'}, revision:{status:'generating'}, task:{status:'processing'}, history }).kind, 'generating');
assert.equal(selectAiDesignerRevisionMode({ template:{id:'t1'}, revision:{status:'ready_for_review'}, task:{status:'reviewing'}, history }).kind, 'requester_review');
assert.equal(selectAiDesignerRevisionMode({ template:null, revision:null, task:{status:'rejected'}, history }).kind, 'initial_framework');
console.log('ai designer content revision core: 6/6 passed');
