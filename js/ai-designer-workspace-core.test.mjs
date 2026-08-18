import assert from 'node:assert/strict';
import test from 'node:test';
import { latestDemoRows, demoSnapshotSignature, shouldPollDemo, pageStates } from './ai-designer-workspace-core.js';

const MODEL='doubao-seedream-4-0-250828';
const VERSION='seedream-demo-creative-director-v2';

test('keeps one latest row per page for the current model and prompt version',()=>{
  const rows=latestDemoRows([
    {id:'old',kind:'demo',model:MODEL,prompt_version:'old',page_index:1,created_at:'2026-01-01'},
    {id:'p1a',kind:'demo',model:MODEL,prompt_version:VERSION,page_index:1,status:'generating',created_at:'2026-01-02'},
    {id:'p1b',kind:'demo',model:MODEL,prompt_version:VERSION,page_index:1,status:'ready',created_at:'2026-01-03'},
    {id:'p2',kind:'demo',model:MODEL,prompt_version:VERSION,page_index:2,status:'generating',created_at:'2026-01-04'},
  ],MODEL,VERSION);
  assert.deepEqual(rows.map(r=>r.id),['p1b','p2']);
});

test('polling continues only while a current page is generating',()=>{
  assert.equal(shouldPollDemo([{status:'ready'},{status:'generating'}],'generating_demo'),true);
  assert.equal(shouldPollDemo([{status:'ready'},{status:'failed'}],'demo_failed'),false);
  assert.equal(shouldPollDemo([{status:'ready'},{status:'ready'}],'demo_review'),false);
});

test('snapshot signature is stable when only wall-clock time changes',()=>{
  const rows=[{id:'p1',status:'ready',page_index:1,output:{image_url:'https://x/1.jpg'}},{id:'p2',status:'generating',page_index:2,output:{}}];
  assert.equal(demoSnapshotSignature(rows,'generating_demo'),demoSnapshotSignature(structuredClone(rows),'generating_demo'));
});

test('ready page stays visible while the next page is generating',()=>{
  const states=pageStates([
    {id:'p1',status:'ready',page_index:1,output:{image_url:'https://x/1.jpg'}},
    {id:'p2',status:'generating',page_index:2,output:{}},
  ],3);
  assert.equal(states[0].status,'ready');
  assert.equal(states[0].image_url,'https://x/1.jpg');
  assert.equal(states[1].status,'generating');
  assert.equal(states[2].status,'waiting');
});
