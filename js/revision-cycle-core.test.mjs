import assert from 'node:assert/strict';
import { activeRevision, feedbackCoveredByRevision, latestRequesterFeedback, nextRevisionNo, revisionStage } from './revision-cycle-core.mjs';

const history = [
  { action:'approve_framework', time:'2026-08-19T08:00:00Z' },
  { action:'reject_draft', reply:'P2乱码', time:'2026-08-19T09:00:00Z' },
  { action:'requester_revision_feedback', requester_feedback:'P3改8000', time:'2026-08-19T10:00:00Z', revision_id:'r2' },
];
assert.equal(latestRequesterFeedback(history).feedback, 'P3改8000');
assert.equal(feedbackCoveredByRevision(latestRequesterFeedback(history), { id:'r2', system_content:'P3改8000' }), true);
assert.equal(feedbackCoveredByRevision({ feedback:'P4新增', time:'2026-08-19T12:00:00Z' }, { id:'r2', system_content:'P3改8000', submitted_at:'2026-08-19T10:01:00Z' }), false);
assert.equal(nextRevisionNo([{revision_no:1},{revision_no:3},{revision_no:2}]), 4);
assert.equal(activeRevision([{revision_no:1},{revision_no:3},{revision_no:2}]).revision_no, 3);
assert.equal(revisionStage('ready_for_review').label, '已交付，等待需求方验收');
assert.equal(revisionStage('superseded').label, '已交付，后续继续修改');
console.log('revision cycle core: 7/7 passed');
