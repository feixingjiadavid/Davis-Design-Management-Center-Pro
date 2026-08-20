import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./requester-ai-stability-v1.js', import.meta.url), 'utf8');
assert.match(source, /confirmAiUnderstanding/);
assert.match(source, /confirmAiDemo/);
assert.match(source, /无生图权限/);
assert.match(source, /需求方只能补充需求信息/);
assert.match(source, /data-generate-demo/);
assert.match(source, /data-generate-final/);
console.log('requester generation guard: 6/6 passed');
