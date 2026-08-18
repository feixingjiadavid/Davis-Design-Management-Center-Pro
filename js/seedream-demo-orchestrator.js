import { latestDemoRows, demoSnapshotSignature, pageStates } from './ai-designer-workspace-core.js';

const MODEL='doubao-seedream-4-0-250828';
const VERSION='seedream-demo-creative-director-v2';
const PAGE_FN='uat-seedream-demo-page';
const GATEWAY_URL='https://bjzfkwxrvytgphvgwltl.supabase.co/functions/v1/uat-ark-gateway';
const POLL_MS=1500;
let supabaseClient=null;
let currentTaskId='';
let cachedState=null;
let lastSignature='';
let pollTimer=null;
let elapsedTimer=null;
let runActive=false;
let runStartedAt=0;
let rendering=false;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function activeTaskId(){return String(document.querySelector('.task.active')?.dataset?.id||'').trim();}
function demoCard(){
  return [...document.querySelectorAll('#detail h3')].find(h=>h.textContent?.trim()==='Demo 版本')?.parentElement||null;
}
function panel(){
  const card=demoCard();if(!card)return null;
  let node=card.querySelector('[data-seedream-v2-panel]');
  if(!node){node=document.createElement('div');node.dataset.seedreamV2Panel='1';card.querySelectorAll(':scope > *:not(h3)').forEach(el=>el.remove());card.appendChild(node);}
  return node;
}
function totalPages(state){return Math.max(1,Number(state?.analysis?.brief?.pages?.length||state?.rows?.[0]?.page_count||1));}
function readyCount(rows){return rows.filter(r=>['ready','confirmed'].includes(String(r.status))).length;}
function currentGenerating(rows){return rows.find(r=>String(r.status)==='generating')||null;}
function firstFailed(rows){return rows.find(r=>String(r.status)==='failed')||null;}
function elapsedSeconds(){return runStartedAt?Math.max(0,Math.floor((Date.now()-runStartedAt)/1000)):0;}

function galleryHtml(states){
  const ready=states.filter(s=>['ready','confirmed'].includes(s.status)&&s.image_url);
  if(!ready.length)return '';
  return '<div class="mt-4 grid gap-4">'+ready.map(s=>'<div class="rounded-xl border border-white/10 overflow-hidden bg-slate-900"><div class="px-3 py-2 flex justify-between text-[11px] text-slate-400"><span>Demo '+String(s.page).padStart(2,'0')+' / '+String(states.length).padStart(2,'0')+'</span><span class="text-emerald-400">ready</span></div><img class="w-full block bg-white" data-demo-page-image="'+s.page+'" src="'+esc(s.image_url)+'"></div>').join('')+'</div>';
}
function pillsHtml(states){
  return '<div class="grid grid-cols-3 gap-2 mt-4">'+states.map(s=>{let label='○ 第 '+s.page+' 页等待',cls='border-white/10 text-slate-500';if(s.status==='generating'){label='● 第 '+s.page+' 页生成中';cls='border-blue-500/40 bg-blue-950/20 text-blue-200'}else if(['ready','confirmed'].includes(s.status)){label='✓ 第 '+s.page+' 页已完成';cls='border-emerald-500/30 bg-emerald-950/20 text-emerald-300'}else if(s.status==='failed'){label='× 第 '+s.page+' 页失败';cls='border-rose-500/30 bg-rose-950/20 text-rose-300'}return '<div class="rounded-lg border '+cls+' p-2 text-[11px]">'+label+'</div>';}).join('')+'</div>';
}
function render(state,force=false){
  const node=panel();if(!node||!state)return;
  const rows=state.rows||[],total=totalPages(state),states=pageStates(rows,total);
  const signature=demoSnapshotSignature(rows,state.task?.status||'');
  if(!force&&signature===lastSignature){const el=node.querySelector('[data-demo-elapsed]');if(el)el.textContent='已耗时 '+elapsedSeconds()+'s';return;}
  lastSignature=signature;
  const generating=currentGenerating(rows),failed=firstFailed(rows),ready=readyCount(rows);
  if(generating||runActive){
    const current=Number(generating?.page_index||Math.min(total,ready+1));
    node.innerHTML='<div class="space-y-3"><div class="flex items-center gap-3"><div class="spin"></div><div class="flex-1"><div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-blue-200">Seedream 4.0 · 第 '+current+' / '+total+' 页生成中</p><span data-demo-elapsed class="text-[11px] text-slate-500">已耗时 '+elapsedSeconds()+'s</span></div><p class="text-xs text-slate-500 mt-1">单页独立请求 · 生成成功立即固定展示 · 任一页失败即停止后续页</p></div></div>'+pillsHtml(states)+galleryHtml(states)+'</div>';
    return;
  }
  if(failed){
    node.innerHTML='<div class="rounded-xl border border-rose-500/25 bg-rose-950/20 p-5"><p class="text-sm font-bold text-rose-300">Seedream 4.0 Demo 第 '+Number(failed.page_index||1)+' 页失败</p><p class="text-xs text-rose-200/75 mt-2 break-words">'+esc(failed.error_message||'生成失败')+'</p><p class="text-[11px] text-slate-500 mt-3">系统已停止后续页，不会自动重试或继续扣费。再次点击只会由你明确发起。</p><button id="demoStartBtnV2" class="btn bg-violet-600 hover:bg-violet-500 text-white mt-4">重新开始 Demo 生成</button></div>'+galleryHtml(states);
    return;
  }
  if(ready>=total){
    node.innerHTML='<div class="space-y-3"><p class="text-sm font-bold text-emerald-400">✓ Seedream 4.0 Demo 已完成 '+ready+' / '+total+'</p><p class="text-xs text-slate-500">页面已固定，不再自动重绘。</p>'+galleryHtml(states)+'</div>';
    return;
  }
  node.innerHTML='<div class="rounded-xl border border-blue-500/20 bg-blue-950/15 p-5"><div class="flex items-start gap-3"><div class="w-8 h-8 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-300">✓</div><div class="flex-1"><p class="text-sm font-bold text-blue-200">Seedream 4.0 Demo 已就绪</p><p class="text-xs text-slate-400 mt-2">使用新版 Creative Director v2。一次手动开始，按 P1 → P2 → P3 顺序生成；失败立即停止。</p><p class="text-[11px] text-slate-500 mt-2">预计 '+total+' 页 · 不自动重试</p><button id="demoStartBtnV2" class="btn bg-violet-600 hover:bg-violet-500 text-white mt-4">开始生成 Seedream 4.0 Demo</button></div></div></div>';
}

async function loadState(taskId=currentTaskId){
  if(!taskId||!supabaseClient)return null;
  const [taskRes,analysisRes,genRes]=await Promise.all([
    supabaseClient.from('test_tasks').select('*').eq('id',taskId).single(),
    supabaseClient.from('uat_requirement_analyses').select('*').eq('task_id',taskId).order('version',{ascending:false}).limit(1).maybeSingle(),
    supabaseClient.from('uat_design_generations').select('*').eq('task_id',taskId).eq('kind','demo').eq('model',MODEL).eq('prompt_version',VERSION).order('created_at',{ascending:true}),
  ]);
  if(taskRes.error)throw taskRes.error;if(analysisRes.error)throw analysisRes.error;if(genRes.error)throw genRes.error;
  const rows=latestDemoRows(genRes.data||[],MODEL,VERSION);
  cachedState={task:taskRes.data,analysis:analysisRes.data,rows};
  return cachedState;
}
async function pollOnce(){
  const id=activeTaskId();if(!id)return;
  if(id!==currentTaskId){currentTaskId=id;lastSignature='';}
  try{const state=await loadState(id);render(state);}catch(error){console.error('Demo 状态轮询失败',error);}
}
function startPolling(){if(pollTimer)return;pollTimer=setInterval(pollOnce,POLL_MS);}
function stopPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=null;}
function startElapsed(){if(elapsedTimer)return;elapsedTimer=setInterval(()=>{const el=panel()?.querySelector('[data-demo-elapsed]');if(el)el.textContent='已耗时 '+elapsedSeconds()+'s';},1000);}
function stopElapsed(){if(elapsedTimer)clearInterval(elapsedTimer);elapsedTimer=null;}

async function checkGateway(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  const token=String(session?.access_token||'');if(!token)throw new Error('UAT_SESSION_MISSING');
  const response=await fetch(GATEWAY_URL,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action:'health'}),signal:AbortSignal.timeout(15000)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.ok!==true)throw new Error(String(payload?.error||payload?.seedream?.error||'ARK_GATEWAY_UNAVAILABLE'));
}
async function waitForPage(taskId,pageIndex,deadline=Date.now()+5*60*1000){
  while(Date.now()<deadline){
    const state=await loadState(taskId);render(state);
    const row=state.rows.find(r=>Number(r.page_index)===pageIndex);
    if(row&&['ready','confirmed'].includes(String(row.status)))return row;
    if(row&&String(row.status)==='failed')throw new Error(String(row.error_message||`第${pageIndex}页生成失败`));
    await new Promise(r=>setTimeout(r,POLL_MS));
  }
  throw new Error(`第${pageIndex}页等待超时，系统已停止，不会自动重试`);
}
async function invokePage(taskId,analysisId,pageIndex,runId,idempotencyKey){
  const {data,error}=await supabaseClient.functions.invoke(PAGE_FN,{body:{task_id:taskId,analysis_id:analysisId,page_index:pageIndex,run_id:runId,idempotency_key:idempotencyKey}});
  if(error)throw error;
  if(!data?.ok)throw new Error(String(data?.error||`第${pageIndex}页生成失败`));
  if(String(data.status)==='generating')return await waitForPage(taskId,pageIndex);
  return data.generation;
}
async function startManualRun(){
  if(runActive)return;
  const taskId=activeTaskId();if(!taskId)return;
  runActive=true;runStartedAt=Date.now();startPolling();startElapsed();
  try{
    const initial=await loadState(taskId);render(initial,true);
    if(!initial.analysis?.id)throw new Error('ANALYSIS_NOT_FOUND');
    const total=totalPages(initial),runId=crypto.randomUUID();
    const card=panel();if(card)card.insertAdjacentHTML('afterbegin','<p data-demo-health class="text-[11px] text-amber-300 mb-3">正在检查 UAT Ark Gateway（不产生生图费用）…</p>');
    await checkGateway();
    panel()?.querySelector('[data-demo-health]')?.remove();
    for(let page=1;page<=total;page++){
      const state=await loadState(taskId);render(state,true);
      const existing=state.rows.find(r=>Number(r.page_index)===page);
      if(existing&&['ready','confirmed'].includes(String(existing.status)))continue;
      if(existing&&String(existing.status)==='generating')await waitForPage(taskId,page);
      else await invokePage(taskId,initial.analysis.id,page,runId,`${runId}-p${page}`);
      await pollOnce();
    }
    await pollOnce();
  }catch(error){
    console.error('Demo 顺序生成停止',error);
    await pollOnce();
    const node=panel();if(node&&!node.textContent?.includes('失败'))node.insertAdjacentHTML('afterbegin','<p class="text-xs text-rose-300 mb-3">'+esc(error instanceof Error?error.message:String(error))+'</p>');
  }finally{
    runActive=false;stopElapsed();await pollOnce();
    const state=cachedState;if(!state?.rows?.some(r=>String(r.status)==='generating'))stopPolling();
  }
}

function installClickGuard(){
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#demoStartBtn,#demoStartBtnV2');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();startManualRun();
  },true);
}
function installObserver(){
  const observer=new MutationObserver(()=>{
    if(rendering)return;
    const id=activeTaskId();if(id&&id!==currentTaskId){currentTaskId=id;lastSignature='';pollOnce();return;}
    if(cachedState&&demoCard()&&!demoCard().querySelector('[data-seedream-v2-panel]')){rendering=true;try{render(cachedState,true);}finally{rendering=false;}}
  });
  observer.observe(document.body,{childList:true,subtree:true});
}
export function bootstrapSeedreamDemoOrchestrator(supabase){
  if(window.__seedreamDemoOrchestratorStarted)return;window.__seedreamDemoOrchestratorStarted=true;supabaseClient=supabase;
  installClickGuard();installObserver();
  setTimeout(()=>{currentTaskId=activeTaskId();if(currentTaskId)pollOnce();},250);
}
