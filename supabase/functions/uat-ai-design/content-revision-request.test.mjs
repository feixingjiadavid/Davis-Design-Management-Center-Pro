import assert from 'node:assert/strict';
import { submitRequesterRevisionRequest } from './content-revision-request.mjs';

const task = { id:'T1', link:'https://docs.qq.com/example' };

function deps(preparedStatus = 'content_ready') {
  const calls = [];
  return {
    calls,
    refreshSources: async (_admin, inputTask) => { calls.push(['refresh', inputTask.id]); },
    prepare: async (_admin, _taskId, _actorId, payload) => {
      calls.push(['prepare', payload]);
      return preparedStatus === 'content_ready'
        ? { status:'content_ready', revision:{ id:'r1' }, affected_pages:[2] }
        : { status:preparedStatus, revision:null, affected_pages:[] };
    },
    queue: async (_admin, _taskId, revisionId, key) => {
      calls.push(['queue', revisionId, key]);
      return { status:'processing', generations:[{ id:'g1' }] };
    },
  };
}

await assert.rejects(() => submitRequesterRevisionRequest({}, task, 'u1', { requester_feedback:'   ', idempotency_key:'k1' }, deps()), /REQUESTER_REVISION_FEEDBACK_REQUIRED/);

const normal = deps();
const result = await submitRequesterRevisionRequest({}, task, 'u1', { requester_feedback:'P2文字乱码', refresh_tencent_doc:false, idempotency_key:'k1' }, normal);
assert.equal(result.status, 'content_ready');
assert.equal(result.generation_started, false);
assert.deepEqual(normal.calls.map((item) => item[0]), ['prepare']);
assert.equal(normal.calls[0][1].system_content, 'P2文字乱码');
assert.equal(normal.calls[0][1].source_mode, 'system_text');

const refreshed = deps();
const refreshedResult = await submitRequesterRevisionRequest({}, task, 'u1', { requester_feedback:'文案已更新', refresh_tencent_doc:true, idempotency_key:'k2' }, refreshed);
assert.equal(refreshedResult.generation_started, false);
assert.deepEqual(refreshed.calls.map((item) => item[0]), ['refresh','prepare']);
assert.equal(refreshed.calls[0][1], 'T1');
assert.equal(refreshed.calls[1][1].source_mode, 'combined');

const conflict = deps('capacity_conflict');
const stopped = await submitRequesterRevisionRequest({}, task, 'u1', { requester_feedback:'新增大量内容', idempotency_key:'k3' }, conflict);
assert.equal(stopped.status, 'capacity_conflict');
assert.equal(stopped.generation_started, false);
assert.equal(conflict.calls.some((item) => item[0] === 'queue'), false);

console.log('content revision request permissions: 4/4 passed');
