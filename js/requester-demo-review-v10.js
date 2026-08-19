import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=requester-demo-review-v10';

let supabase=null;
let taskId='';
let rendering=false;
let timer=null;
let observer=null;

const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function currentTaskId(){
  return String(new URLSearchParams(location.search).get('id')||'').trim();
}

function removeLegacyDemoUI(){
  const content=document.getElementById('ai-requirement-content');
  if(!content)return;
  content.querySelectorAll('button[onclick*="confirmAiDemo"], [data-v8-confirm-demo]').forEach(node=>node.remove());
  const old=document.getElementById('requester-drive-demo-gallery-v7');
  if(old)old.style.display='none';
  [...content.querySelectorAll('p')].filter(p=>p.textContent?.trim()==='Demo 版本').forEach(p=>{
    const block=p.parentElement;
    if(block)block.style.display='none';
  });
}

function ensureHost(){
  const anchor=document.getElementById('ai-requirement-panel');
  if(!anchor)return null;
  let host=document.getElementById('requester-demo-review-v10');
  if(host)return host;
  host=document.createElement('section');
  host.id='requester-demo-review-v10';
  host.className='bg-[#121217] border border-emerald-500/20 rounded-2xl p-7 relative overflow-hidden';
  anchor.insertAdjacentElement('afterend',host);
  return host;
}

async function loadRows(){
  const {data,error}=await supabase.from('uat_design_generations')
    .select('*')
    .eq('task_id',taskId)
    .eq('kind','demo')
    .eq('model',DEMO_MODEL)
    .eq('prompt_version',DEMO_VERSION)
    .order('created_at',{ascending:true});
  if(error)throw error;
  return selectCurrentDemoPages(data||[]);
}

function outputOf(row){
  if(row?.output&&typeof row.output==='object')return row.output;
  try{return JSON.parse(String(row?.output||'{}'))}catch{return{}}
}

function readyRows(rows){
  return (rows||[]).filter(row=>['ready','confirmed'].includes(String(row.status))).sort((a,b)=>Number(a.page_index||1)-Number(b.page_index||1));
}

function shell(host,rows){
  const ready=readyRows(rows);
  const total=Math.max(3,...rows.map(r=>Number(r.page_count||0)),ready.length);
  host.innerHTML=`
    <div class="flex items-start justify-between gap-4 mb-5">
      <div><h3 class="text-base font-bold text-white">Demo 方案验收</h3><p class="text-xs text-zinc-500 mt-1">方案原图来自 Google Drive。3 张全部真实显示后才能确认进入成品阶段。</p></div>
      <span class="text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">${ready.length}/${total} 已归档</span>
    </div>
    <div data-demo-review-grid class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${ready.map(row=>{
        const page=Number(row.page_index||1),o=outputOf(row),fid=String(o.drive_file_id||'').trim(),drive=String(o.drive_url||'').trim();
        return `<article data-demo-review-page="${page}" class="rounded-xl overflow-hidden border border-white/10 bg-[#0d1220]">
          <div class="px-3 py-2 flex items-center justify-between text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div>
          <div data-demo-review-preview="${esc(fid)}" class="min-h-[260px] flex items-center justify-center px-4 text-center text-xs text-slate-500">正在读取云盘原图…</div>
          <div class="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 flex justify-between gap-3"><span>Seedream 4.0 · 1242×1660</span>${drive?`<a href="${esc(drive)}" target="_blank" rel="noopener" class="text-blue-400">打开云盘原图 ↗</a>`:''}</div>
        </article>`;
      }).join('') || '<div class="col-span-full py-10 text-center text-sm text-zinc-500">暂无可验收 Demo。</div>'}
    </div>
    <div data-demo-review-confirm class="mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-500">正在验证 3 张 Demo 是否可以正常显示…</div>`;
  return {ready,total};
}

async function hydrate(host,rows,total){
  let visible=0;
  let failed=0;
  const ready=readyRows(rows);
  for(const row of ready){
    const o=outputOf(row),fid=String(o.drive_file_id||'').trim();
    const slot=host.querySelector(`[data-demo-review-page="${Number(row.page_index||1)}"] [data-demo-review-preview]`);
    if(!slot||!fid){failed+=1;continue;}
    try{
      const url=await getDrivePreviewObjectUrl(supabase,fid);
      const img=new Image();
      img.alt=`Demo ${Number(row.page_index||1)}`;
      img.className='w-full block object-contain bg-white cursor-zoom-in';
      img.src=url;
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('IMAGE_DECODE_FAILED'));});
      img.onclick=()=>typeof window.openPreview==='function'?window.openPreview(url):window.open(url,'_blank','noopener');
      slot.replaceChildren(img);
      slot.className='bg-white';
      visible+=1;
    }catch(error){
      failed+=1;
      slot.className='min-h-[220px] flex items-center justify-center px-4 text-center text-xs text-rose-300';
      slot.textContent=`云盘预览加载失败：${error instanceof Error?error.message:String(error)}`;
    }
  }
  const confirm=host.querySelector('[data-demo-review-confirm]');
  if(!confirm)return;
  if(ready.length>=total&&visible>=total&&failed===0){
    const generationId=String(ready[ready.length-1]?.id||'');
    confirm.className='mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4';
    confirm.innerHTML=`<p class="text-xs text-amber-200 mb-3">3/3 张 Demo 已真实显示。确认后才会进入 Seedream 4.0 成品生成。</p><button data-requester-confirm-demo="${esc(generationId)}" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold">确认这 3 张 Demo，生成 Seedream 4.0 成品</button>`;
    const button=confirm.querySelector('[data-requester-confirm-demo]');
    if(button)button.onclick=()=>{
      if(typeof window.confirmAiDemo!=='function')return window.showToast?.('暂时无法确认','确认流程尚未加载完成，请稍后再点。','info');
      window.confirmAiDemo(button.dataset.requesterConfirmDemo);
    };
  }else{
    confirm.className='mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-500';
    confirm.textContent=failed?`当前 ${visible}/${total} 张可见，${failed} 张预览失败；预览恢复前禁止确认。`:`当前 ${visible}/${total} 张可见；3 张全部显示后才允许确认。`;
  }
}

async function render(){
  if(rendering||!supabase||!taskId)return;
  rendering=true;
  try{
    removeLegacyDemoUI();
    const host=ensureHost();
    if(!host)return;
    const rows=await loadRows();
    const {total}=shell(host,rows);
    await hydrate(host,rows,total);
    removeLegacyDemoUI();
  }catch(error){
    const host=ensureHost();
    if(host)host.innerHTML=`<div class="text-sm text-rose-300">Demo 验收区加载失败：${esc(error instanceof Error?error.message:String(error))}</div>`;
  }finally{rendering=false;}
}

function schedule(delay=80){clearTimeout(timer);timer=setTimeout(render,delay);}

export function bootstrapRequesterDemoReviewV10(client){
  if(window.__requesterDemoReviewV10Started)return;
  if((location.pathname.split('/').pop()||'')!=='task-detail-requester.html')return;
  window.__requesterDemoReviewV10Started=true;
  supabase=client;
  taskId=currentTaskId();
  observer=new MutationObserver(()=>{removeLegacyDemoUI();schedule();});
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{removeLegacyDemoUI();schedule(0);},2500);
  schedule(0);
}
