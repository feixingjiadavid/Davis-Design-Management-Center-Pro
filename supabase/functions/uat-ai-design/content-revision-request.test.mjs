import assert from 'node:assert/strict';
import { submitRequesterRevisionRequest } from './content-revision-request.mjs';

function deps(preparedStatus = 'content_ready') {
  const calls = [];
  return {
    calls,
    refreshSources: async () => { calls.push('refresh'); },
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

await assert.rejects(() => submitRequesterRevisionRequest({}, 'T1', 'u1', { requester_feedback:'   ', idempotency_key:'k1' }, deps()), /REQUESTER_REVISION_FEEDBACK_REQUIRED/);

const normal = deps();
const result = await submitRequesterRevisionRequest({}, 'T1', 'u1', { requester_feedback:'P2文字乱码', refresh_tencent_doc:false, idempotency_key:'k1' }, normal);
assert.equal(result.status, 'processing');
assert.deepEqual(normal.calls.map((item) => Array.isArray(item) ? item[0] : item), ['prepare','queue']);
assert.equal(normal.calls[0][1].system_content, 'P2文字乱码');
assert.equal(normal.calls[0][1].source_mode, 'system_text');

const refreshed = deps();
await submitRequesterRevisionRequest({}, 'T1', 'u1', { requester_feedback:'文案已更新', refresh_tencent_doc:true, idempotency_key:'k2' }, refreshed);
assert.deepEqual(refreshed.calls.map((item) => Array.isArray(item) ? item[0] : item), ['refresh','prepare','queue']);
assert.equal(refreshed.calls[1][1].source_mode, 'combined');

const conflict = deps('capacity_conflict');
const stopped = await submitRequesterRevisionRequest({}, 'T1', 'u1', { requester_feedback:'新增大量内容', idempotency_key:'k3' }, conflict);
assert.equal(stopped.status, 'capacity_conflict');
assert.equal(conflict.calls.some((item) => Array.isArray(item) && item[0] === 'queue'), false);

console.log('content revision request: 4/4 passed');
