import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ai-designer-content-revision-mode-v1.js', import.meta.url), 'utf8');
assert.match(source, /需求方最新修改意见/);
assert.match(source, /prepareContentRevision/);
assert.match(source, /generateContentRevision/);
assert.match(source, /只有 AI 设计师能够触发生图/);
assert.match(source, /完成后直接回到需求方验收|修改完成后直接回需求方验收/);
assert.doesNotMatch(source, /pending_approval/);
assert.doesNotMatch(source, /generateFrameworkRevision/);
assert.doesNotMatch(source, /提交领导|等待领导审核|领导审核框架/);
console.log('ai designer locked-template mode: 8/8 passed');
