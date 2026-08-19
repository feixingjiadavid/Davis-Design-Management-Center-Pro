import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=drive-preview-v7';

let supabase=null;
let renderTimer=null;
let observer=null;
let heartbeat=null;
let running=false;

const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pageName=()=>location.pathname.split('/').pop()||'index.html';
const outputOf=(row)=>{
  if(row?.output&&typeof row.output==='object')return row.output;
  try{return JSON.parse(String(row?.output||'{}'))}catch{return{}}
};
const taskIdForPage=()=>{
  if(pageName()==='ai-designer-workspace.html')return String(document.querySelector('.task.active')?.dataset?.id||'').trim();
  if(pageName()==='task-detail-requester.html')return String(new URLSearchParams(location.search).get('id')||'').trim();
  return '';
};

function rowsSnapshot(rows){
  return JSON.stringify((rows||[]).map(row=>{
    const o=outputOf(row);
    return [row.id,row.page_index,row.status,row.updated_at,o.drive_file_id,o.drive_url];
  }));
}

function demoTotal(rows){
  return Math.max(1,...(rows||[]).map(row=>Number(row.page_count||0)));
}

function readyRows(rows){
  return (rows||[])
    .filter(row=>['ready','confirmed'].includes(String(row.status)))
    .sort((a,b)=>Number(a.page_index||1)-Number(b.page_index||1));
}

async function loadCurrentRows(taskId){
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

function cardsHtml(rows){
  const ready=readyRows(rows);
  const total=Math.max(3,demoTotal(rows),ready.length);
  if(!ready.length)return '<div class="col-span-full rounded-xl border border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-zinc-500">暂无已完成 Demo 页面。</div>';
  return ready.map(row=>{
    const page=Number(row.page_index||1);
    const o=outputOf(row);
    const fid=String(o.drive_file_id||'').trim();
    const driveUrl=String(o.drive_url||'').trim();
    const legacy=String(o.image_url||'').trim();
    let media='';
    if(fid){
      media=`<div data-v7-drive-file="${esc(fid)}" class="min-h-[260px] flex items-center justify-center bg-[#0d1220] text-xs text-slate-500">正在从 Google Drive 安全读取原图…</div>`;
    }else if(/^https?:\/\//i.test(legacy)){
      media=`<img src="${esc(legacy)}" alt="Demo ${page}" class="w-full block object-contain bg-white">`;
    }else{
      media='<div class="min-h-[260px] flex items-center justify-center bg-[#0d1220] text-xs text-amber-300">该页已完成，但缺少持久化 Drive 文件 ID</div>';
    }
    return `<article class="rounded-xl overflow-hidden border border-white/10 bg-[#101624] shadow-sm" data-v7-demo-page="${page}">
      <div class="px-3 py-2 flex items-center justify-between gap-3 text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div>
      ${media}
      <div class="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-3 text-[10px] text-slate-500"><span>${esc(row.model||'Seedream 4.0')} · 1242×1660</span>${driveUrl?`<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">打开云盘原图 ↗</a>`:''}</div>
    </article>`;
  }).join('');
}

function fillHost(host,snapshot,html){
  if(host.dataset.drivePreviewSnapshot===snapshot&&host.firstElementChild)return false;
  host.innerHTML=html;
  host.dataset.drivePreviewSnapshot=snapshot;
  return true;
}

async function hydrateDriveImages(host){
  const nodes=[...host.querySelectorAll('[data-v7-drive-file]')];
  for(const node of nodes){
    const fid=String(node.dataset.v7DriveFile||'').trim();
    if(!fid||node.dataset.v7Hydrated==='1'||node.dataset.v7Hydrated==='loading')continue;
    node.dataset.v7Hydrated='loading';
    try{
      const url=await getDrivePreviewObjectUrl(supabase,fid);
      const image=document.createElement('img');
      image.src=url;
      image.alt='Seedream Demo Google Drive preview';
      image.className='w-full block object-contain bg-white cursor-zoom-in';
      image.loading='eager';
      image.onclick=()=>{
        if(typeof window.openPreview==='function')window.openPreview(url);
        else window.open(url,'_blank','noopener');
      };
      node.replaceChildren(image);
      node.dataset.v7Hydrated='1';
    }catch(error){
      node.dataset.v7Hydrated='error';
      node.className='min-h-[220px] flex items-center justify-center px-5 text-center bg-[#0d1220] text-xs text-rose-300';
      node.textContent=`云盘预览加载失败：${error instanceof Error?error.message:String(error)}`;
    }
  }
  return {
    visibleImages:host.querySelectorAll('[data-v7-demo-page] img').length,
    failedPreviews:host.querySelectorAll('[data-v7-hydrated="error"]').length,
  };
}

function findLegacyWorkspaceGallery(panel){
  const candidates=[...panel.querySelectorAll('div.grid')];
  return candidates.find(node=>node.id!=='ai-drive-demo-gallery-v7-grid'&&/Demo\s*0?1\s*\/\s*0?3/i.test(node.textContent||''))||null;
}

async function renderWorkspace(rows,taskId){
  const panel=document.getElementById('ai-visual-context-panel');
  if(!panel)return false;
  const legacy=findLegacyWorkspaceGallery(panel);
  if(legacy)legacy.style.display='none';
  let host=document.getElementById('ai-drive-demo-gallery-v7');
  if(!host){
    host=document.createElement('section');
    host.id='ai-drive-demo-gallery-v7';
    host.className='mt-4';
    panel.appendChild(host);
  }
  const snapshot=`${taskId}:${rowsSnapshot(rows)}`;
  fillHost(host,snapshot,`<div class="flex items-center justify-between gap-3 mb-3"><p class="text-xs font-bold text-emerald-300">Seedream Demo · Google Drive 持久化预览</p><span class="text-[10px] text-slate-500">${readyRows(rows).length}/${Math.max(3,demoTotal(rows))} 已完成</span></div><div id="ai-drive-demo-gallery-v7-grid" class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${cardsHtml(rows)}</div>`);
  await hydrateDriveImages(host);
  return true;
}

function hideRequesterLegacyDemo(content){
  [...content.querySelectorAll('p')].filter(p=>p.textContent?.trim()==='Demo 版本').forEach(p=>{
    const block=p.parentElement;
    if(block&&block.id!=='requester-drive-demo-gallery-v7')block.style.display='none';
  });
}

function removeLegacyRequesterConfirm(content){
  content.querySelectorAll('button[onclick*="confirmAiDemo"]').forEach(button=>button.remove());
}

function requesterHostHtml(rows){
  const readyCount=readyRows(rows).length;
  const total=Math.max(3,demoTotal(rows));
  return `<div class="flex items-center justify-between gap-3 mb-4"><div><p class="font-bold text-white">Demo 版本 · ${readyCount}/${total}</p><p class="text-xs text-zinc-500 mt-1">图片已持久化到 Google Drive，3 张方案必须全部真实显示后才能确认。</p></div><span class="text-xs text-emerald-400">${readyCount===total?'全部生成完成':'生成中'}</span></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${cardsHtml(rows)}</div><div data-v8-confirm-slot class="mt-4"></div>`;
}

function updateRequesterConfirmGate(host,rows){
  const slot=host.querySelector('[data-v8-confirm-slot]');
  if(!slot)return;
  const ready=readyRows(rows);
  const total=Math.max(3,demoTotal(rows));
  const visible=host.querySelectorAll('[data-v7-demo-page] img').length;
  const errors=host.querySelectorAll('[data-v7-hydrated="error"]').length;
  if(ready.length>=total&&visible>=total){
    const generationId=String(ready[ready.length-1]?.id||'');
    slot.innerHTML=`<div class="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4"><p class="text-xs text-amber-200 mb-3">已确认 ${visible}/${total} 张 Demo 均可见。确认后才会进入 Seedream 4.0 成品生成。</p><button data-v8-confirm-demo="${esc(generationId)}" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold">确认这 ${total} 张 Demo，生成 Seedream 4.0 成品</button></div>`;
    const button=slot.querySelector('[data-v8-confirm-demo]');
    if(button)button.onclick=()=>{
      if(typeof window.confirmAiDemo!=='function')return;
      window.confirmAiDemo(button.dataset.v8ConfirmDemo);
    };
    return;
  }
  const detail=errors?`其中 ${errors} 张云盘预览读取失败，请先解决预览问题。`:`当前已显示 ${visible}/${total} 张，全部可见后才允许确认。`;
  slot.innerHTML=`<div class="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-500">${detail}</div>`;
}

async function renderRequester(rows,taskId){
  const content=document.getElementById('ai-requirement-content');
  if(!content)return false;
  hideRequesterLegacyDemo(content);
  removeLegacyRequesterConfirm(content);
  let host=document.getElementById('requester-drive-demo-gallery-v7');
  if(!host){
    host=document.createElement('section');
    host.id='requester-drive-demo-gallery-v7';
    host.className='mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4';
    content.appendChild(host);
  }
  const snapshot=`${taskId}:${rowsSnapshot(rows)}`;
  fillHost(host,snapshot,requesterHostHtml(rows));
  updateRequesterConfirmGate(host,rows);
  await hydrateDriveImages(host);
  updateRequesterConfirmGate(host,rows);
  return true;
}

async function renderNow(){
  if(running||!supabase)return;
  const path=pageName();
  if(path!=='ai-designer-workspace.html'&&path!=='task-detail-requester.html')return;
  const taskId=taskIdForPage();
  if(!taskId)return;
  running=true;
  try{
    const rows=await loadCurrentRows(taskId);
    if(path==='ai-designer-workspace.html')await renderWorkspace(rows,taskId);
    else await renderRequester(rows,taskId);
  }catch(error){
    console.error('Seedream Drive v8 预览同步失败',error);
  }finally{
    running=false;
  }
}

function schedule(delay=120){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(renderNow,delay);
}

export function bootstrapSeedreamDrivePreviewUIV7(client){
  if(window.__seedreamDrivePreviewUIV7Started)return;
  window.__seedreamDrivePreviewUIV7Started=true;
  supabase=client;
  observer=new MutationObserver(()=>schedule());
  observer.observe(document.body,{childList:true,subtree:true});
  heartbeat=setInterval(()=>schedule(0),2500);
  schedule(0);
}
