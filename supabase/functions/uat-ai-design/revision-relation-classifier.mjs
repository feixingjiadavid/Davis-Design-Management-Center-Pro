const DEFAULT_PROXY='https://supffjeeouibhqdfqosk.supabase.co/functions/v1/uat-deepseek-proxy';
const DEFAULT_MODEL='deepseek-v4-flash';

function safeText(value){return String(value??'').trim();}
function parseJsonContent(payload){
  const content=typeof payload?.content==='string'?payload.content:typeof payload?.choices?.[0]?.message?.content==='string'?payload.choices[0].message.content:'';
  if(!content.trim()) throw new Error('REVISION_RELATION_EMPTY');
  return JSON.parse(content);
}

export async function classifyRevisionRelation({feedback,previousRevision,userJwt,fetcher=fetch,proxyUrl=DEFAULT_PROXY,model=DEFAULT_MODEL}={}){
  const current=safeText(feedback);
  if(!previousRevision||!current) return {relation:'new_requirement',confidence:1,reason:'no_previous_delivered_revision',source:'default'};
  const jwt=safeText(userJwt);
  if(!jwt) return {relation:'new_requirement',confidence:0,reason:'missing_jwt_fallback',source:'fallback'};
  const previousInstruction=safeText(previousRevision.system_content||previousRevision?.change_summary?.requester_feedback);
  const previousSummary=JSON.stringify(previousRevision.change_summary||{});
  const prompt=`你是设计修改关系分类器，只做分类，不修改需求。\n\n请判断“本次需求方反馈”与“上一版已交付修改”的关系：\n- quality_retry：上一版没有达到已经明确提出过的目标，例如乱码、漏改、改错位置、误改Logo/IP、扩大修改范围、旧要求没有执行正确。\n- new_requirement：上一版已满足原目标，需求方现在新增、删除或改变了新的业务/设计要求。\n\n上一版 revision_no：${Number(previousRevision.revision_no||0)}\n上一版执行指令：${previousInstruction||'无'}\n上一版元数据：${previousSummary}\n本次需求方反馈：${current}\n\n只输出 JSON：{"relation":"quality_retry|new_requirement","confidence":0到1,"reason":"一句话理由"}`;
  try{
    const response=await fetcher(proxyUrl,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify({prompt,model}),signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw new Error(`REVISION_RELATION_HTTP_${response.status}`);
    const payload=await response.json();
    const parsed=parseJsonContent(payload);
    const relation=parsed?.relation==='quality_retry'?'quality_retry':'new_requirement';
    const confidence=Number(parsed?.confidence||0);
    if(relation==='quality_retry'&&confidence<0.75) return {relation:'new_requirement',confidence,reason:safeText(parsed?.reason)||'low_confidence_fallback',source:'deepseek_low_confidence_fallback'};
    return {relation,confidence,reason:safeText(parsed?.reason),source:'deepseek'};
  }catch(error){
    return {relation:'new_requirement',confidence:0,reason:error instanceof Error?error.message:String(error),source:'fallback'};
  }
}
