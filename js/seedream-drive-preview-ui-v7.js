import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=drive-preview-v8-current-uat';
import { createLazyPreviewQueue } from './lazy-drive-preview-v1.js?v=all-stages-lazy-v1';

let supabase=null,renderTimer=null,heartbeat=null,running=false,lazy=null;
const objectUrls=new Map();
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pageName=()=>location.pathname.split('/').pop()||'index.html';
const outputOf=(row)=>{if(row?.output&&typeof row.output==='object')return row.output;try{return JSON.parse(String(row?.output||'{}'))}catch{return{}}};
const activeAiTaskId=()=>String(document.querySelector('.task.active')?.dataset?.id||'').trim();
const readyRows=(rows)=>(rows||[]).filter(row=>['ready','confirmed'].includes(String(row.status))).sort((a,b)=>Number(a.page_index||1)-Number(b.page_index||1));
const demoTotal=(rows)=>Math.max(1,...(rows||[]).map(row=>Number(row.page_count||0)));
const rowsSnapshot=(rows)=>JSON.stringify((rows||[]).map(row=>{const o=outputOf(row);return[row.id,row.page_index,row.status,row.updated_at,o.drive_file_id,o.drive_url]}));

async function loadCurrentRows(taskId){const{data,error}=await supabase.from('uat_design_generations').select('*').eq('task_id',taskId).eq('kind','demo').eq('model',DEMO_MODEL).eq('prompt_version',DEMO_VERSION).order('created_at',{ascending:true});if(error)throw error;return selectCurrentDemoPages(data||[])}

function cardsHtml(rows){
  const ready=readyRows(rows),total=Math.max(3,demoTotal(rows),ready.length);
  if(!ready.length)return'<div class="col-span-full rounded-xl border border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-zinc-500">暂无已完成 Demo 页面。</div>';
  return ready.map(row=>{const page=Number(row.page_index||1),o=outputOf(row),fid=String(o.drive_file_id||'').trim(),driveUrl=String(o.drive_url||'').trim(),legacy=String(o.image_url||'').trim();let media='';if(fid)media=`<div data-v7-drive-file="${esc(fid)}" class="min-h-[260px] flex items-center justify-center bg-[#0d1220] text-xs text-slate-500">进入视口后读取高清原图…</div>`;else if(/^https?:\/\//i.test(legacy))media=`<img loading="lazy" decoding="async" src="${esc(legacy)}" alt="Demo ${page}" class="w-full block object-contain bg-white">`;else media='<div class="min-h-[260px] flex items-center justify-center bg-[#0d1220] text-xs text-amber-300">该页已完成，但缺少持久化 Drive 文件 ID</div>';return `<article class="rounded-xl overflow-hidden border border-white/10 bg-[#101624] shadow-sm" data-v7-demo-page="${page}"><div class="px-3 py-2 flex items-center justify-between gap-3 text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div>${media}<div class="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-3 text-[10px] text-slate-500"><span>${esc(row.model||'Seedream 4.0')} · 1242×1660</span>${driveUrl?`<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">打开云盘原图 ↗</a>`:''}</div></article>`}).join('')
}

function fillHost(host,snapshot,html){if(host.dataset.drivePreviewSnapshot===snapshot&&host.firstElementChild)return false;host.innerHTML=html;host.dataset.drivePreviewSnapshot=snapshot;return true}
async function preview(fid){if(objectUrls.has(fid))return objectUrls.get(fid);const url=await getDrivePreviewObjectUrl(supabase,fid);objectUrls.set(fid,url);return url}
function installLazy(){if(lazy)return;lazy=createLazyPreviewQueue({rootMargin:'1200px 0px',concurrency:2,hydrate:async(node,{fid})=>{const url=await preview(fid),image=document.createElement('img');image.src=url;image.alt='Seedream Google Drive preview';image.className='w-full block object-contain bg-white cursor-zoom-in';image.loading='lazy';image.decoding='async';await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('IMAGE_DECODE_FAILED'))});image.onclick=()=>typeof window.openPreview==='function'?window.openPreview(url):window.open(url,'_blank','noopener');node.replaceChildren(image);node.className='bg-white'}})}
function bindLazy(host){installLazy();host.querySelectorAll('[data-v7-drive-file]').forEach(node=>{const fid=String(node.dataset.v7DriveFile||'').trim();if(!fid)return;node.addEventListener('lazy-preview-error',event=>{node.className='min-h-[220px] flex items-center justify-center px-5 text-center bg-[#0d1220] text-xs text-rose-300';node.textContent=`云盘预览加载失败：${event.detail instanceof Error?event.detail.message:String(event.detail)}`},{once:true});lazy.observe(node,{fid})})}

function findLegacyWorkspaceGallery(panel){const candidates=[...panel.querySelectorAll('div.grid')];return candidates.find(node=>node.id!=='ai-drive-demo-gallery-v7-grid'&&/Demo\s*0?1\s*\/\s*0?3/i.test(node.textContent||''))||null}
function renderWorkspace(rows,taskId){const panel=document.getElementById('ai-visual-context-panel');if(!panel)return false;const legacy=findLegacyWorkspaceGallery(panel);if(legacy)legacy.style.display='none';let host=document.getElementById('ai-drive-demo-gallery-v7');if(!host){host=document.createElement('section');host.id='ai-drive-demo-gallery-v7';host.className='mt-4';panel.appendChild(host)}const snapshot=`${taskId}:${rowsSnapshot(rows)}`;const changed=fillHost(host,snapshot,`<div class="flex items-center justify-between gap-3 mb-3"><p class="text-xs font-bold text-emerald-300">Seedream Demo · Google Drive 持久化预览</p><span class="text-[10px] text-slate-500">${readyRows(rows).length}/${Math.max(3,demoTotal(rows))} 已完成</span></div><div id="ai-drive-demo-gallery-v7-grid" class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${cardsHtml(rows)}</div>`);if(changed)bindLazy(host);return true}

async function renderNow(){if(running||!supabase||document.hidden||pageName()!=='ai-designer-workspace.html')return;const taskId=activeAiTaskId();if(!taskId)return;running=true;try{const rows=await loadCurrentRows(taskId);renderWorkspace(rows,taskId)}catch(error){console.error('Seedream Drive 预览同步失败',error)}finally{running=false}}
function schedule(delay=250){clearTimeout(renderTimer);renderTimer=setTimeout(renderNow,delay)}

export function bootstrapSeedreamDrivePreviewUIV7(client){
  if(window.__seedreamDrivePreviewUIV7Started)return;
  window.__seedreamDrivePreviewUIV7Started=true;
  supabase=client;
  document.addEventListener('click',event=>{if(event.target?.closest?.('.task'))schedule(350)},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});
  heartbeat=setInterval(()=>{if(!document.hidden)schedule(0)},12000);
  schedule(0);
  window.addEventListener('beforeunload',()=>{clearInterval(heartbeat);clearTimeout(renderTimer);lazy?.disconnect()},{once:true});
}

