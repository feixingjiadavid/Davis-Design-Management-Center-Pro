import assert from 'node:assert/strict';
import { inferFeedbackAffectedPages, mergeAffectedPages } from './revision-feedback.mjs';

const pages = [
  { page_index: 1, page_title: '封面页' },
  { page_index: 2, page_title: '规则页' },
  { page_index: 3, page_title: '补充页' },
];

assert.deepEqual(inferFeedbackAffectedPages('P2出现文字乱码，需要纠正', pages), [2]);
assert.deepEqual(inferFeedbackAffectedPages('规则页的金额改成8000元豆', pages), [2]);
assert.deepEqual(inferFeedbackAffectedPages('第3页底部说明需要删除', pages), [3]);
assert.deepEqual(inferFeedbackAffectedPages('整体文字清晰度需要修正', pages), [1, 2, 3]);
assert.deepEqual(mergeAffectedPages([2], [2, 3]), [2, 3]);

console.log('revision feedback: 5/5 passed');
