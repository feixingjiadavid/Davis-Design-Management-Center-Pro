import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./requester-framework-revision-flow-v3.js', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('./requester-framework-revision-flow-v2.js', import.meta.url), 'utf8');
assert.match(source, /提交修改给 AI 设计师/);
assert.match(source, /我已更新腾讯文档，请同时读取最新内容/);
assert.match(source, /submitContentRevisionRequest/);
assert.match(source, /无权推倒框架，也不会再次进入领导审核/);
assert.match(source, /FRAMEWORK|母版已锁定/);
assert.doesNotMatch(source, /检测腾讯文档最新内容/);
assert.doesNotMatch(source, /分析内容变化（不生图）/);
assert.doesNotMatch(source, /data-template-action="generate-content"/);
assert.match(legacy, /bootstrapRequesterFrameworkRevisionFlowV3/);
assert.doesNotMatch(legacy, /检测腾讯文档最新内容/);
assert.doesNotMatch(legacy, /分析内容变化（不生图）/);
assert.doesNotMatch(legacy, /data-template-action="generate-content"/);
console.log('requester revision flow v3 compatibility: 12/12 passed');
