import assert from 'node:assert/strict';
import { classifyRevisionRelation } from './revision-relation-classifier.mjs';

const previous={revision_no:1,system_content:'P2修乱码；P3旗帜下方文化大使改科技讲师',change_summary:{selected_model:'doubao-seedream-4-5-251128'}};
let result=await classifyRevisionRelation({
  feedback:'P2还是乱码，P3改错位置了',previousRevision:previous,userJwt:'jwt',
  fetcher:async()=>new Response(JSON.stringify({content:JSON.stringify({relation:'quality_retry',confidence:0.94,reason:'上一版执行未达到原目标'})}),{status:200,headers:{'content-type':'application/json'}}),
});
assert.equal(result.relation,'quality_retry');

result=await classifyRevisionRelation({
  feedback:'上一版没问题，再把日期改成8月30日',previousRevision:previous,userJwt:'jwt',
  fetcher:async()=>new Response(JSON.stringify({content:JSON.stringify({relation:'new_requirement',confidence:0.91,reason:'新增需求'})}),{status:200,headers:{'content-type':'application/json'}}),
});
assert.equal(result.relation,'new_requirement');

result=await classifyRevisionRelation({
  feedback:'不确定',previousRevision:previous,userJwt:'jwt',
  fetcher:async()=>new Response(JSON.stringify({content:JSON.stringify({relation:'quality_retry',confidence:0.5,reason:'低置信度'})}),{status:200,headers:{'content-type':'application/json'}}),
});
assert.equal(result.relation,'new_requirement');

result=await classifyRevisionRelation({ feedback:'anything',previousRevision:null,userJwt:'jwt' });
assert.equal(result.relation,'new_requirement');
console.log('revision relation classifier tests passed');
