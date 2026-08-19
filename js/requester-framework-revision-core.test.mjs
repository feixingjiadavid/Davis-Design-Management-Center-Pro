import assert from 'node:assert/strict';
import { selectRequesterFlowState } from './requester-framework-revision-core.mjs';

assert.equal(selectRequesterFlowState({ task:{status:'rejected'}, template:null, revisions:[], history:[{action:'reject_framework',reply:'方向不合适'}] }).kind, 'framework_rejected_waiting_requester');
assert.equal(selectRequesterFlowState({ task:{status:'reviewing'}, template:{id:'t1'}, revisions:[], history:[{action:'approve_framework'}] }).kind, 'template_review');
assert.equal(selectRequesterFlowState({ task:{status:'processing'}, template:{id:'t1'}, revisions:[{revision_no:1,status:'generating'}], history:[] }).kind, 'content_revision_generating');
assert.equal(selectRequesterFlowState({ task:{status:'reviewing'}, template:{id:'t1'}, revisions:[{revision_no:1,status:'ready_for_review'}], history:[] }).kind, 'content_revision_review');
assert.equal(selectRequesterFlowState({ task:{status:'reviewing'}, template:{id:'t1'}, revisions:[{revision_no:1,status:'capacity_conflict'}], history:[] }).kind, 'capacity_conflict');
assert.equal(selectRequesterFlowState({ task:{status:'completed'}, template:{id:'t1'}, revisions:[], history:[] }).kind, 'completed');
console.log('requester framework revision core: 6/6 passed');
