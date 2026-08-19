import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=leader-hd-review-v1';
import { isLeaderUser, selectHdPages } from './leader-demo-hd-review-core.mjs?v=leader-hd-review-v1';

let client=null;
let taskId='';
let pages=[];
let currentIndex=0;
const objectUrls=new Map();

function currentUser(){try{return JSON.parse(localStorage.getItem('activeUserObj')||'{}')}catch{return{}}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function loadPages(){
  const {data,error}=await client.from('uat_design_generations')
    .select('*').eq('task_id',taskId).eq('kind','demo').eq('model',DEMO_MODEL).eq('prompt_version',DEMO_VERSION)
    .order('created_at',{ascending:true});
  if(error)throw error;
  pages=selectHdPages(selectCurrentDemoPages(data||[]));
  return pages;
}

async function urlFor(fileId){
  if(objectUrls.has(fileId))return objectUrls.get(fileId);
  const url=await getDrivePreviewObjectUrl(client,fileId);
  objectUrls.set(fileId,url);
  return url;
}

function ensureOverlay(){
  let overlay=document.getElementById('leader-demo-hd-review-v1');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='leader-demo-hd-review-v1';
  overlay.className='fixed inset-0 z-[1000000] hidden bg-black/95';
  overlay.innerHTML=`
    <div class="h-full flex flex-col">
      <div class="shrink-0 px-6 py-4 border-b border-white/10 bg-black/60 backdrop-blur-xl flex items-center justify-between gap-4">
        <div>
          <div class="text-white font-bold text-lg">框架方案 · 高清审核模式</div>
          <div id="leader-hd-subtitle" class="text-xs text-zinc-400 mt-1">读取 Google Drive 原始大图…</div>
        </div>
        <div class="flex items-center gap-2">
          <button id="leader-hd-prev" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">← 上一张</button>
          <button id="leader-hd-next" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm">下一张 →</button>
          <button id="leader-hd-close" class="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white text-sm">关闭</button>
        </div>
      </div>
      <div class="shrink-0 px-6 py-3 border-b border-white/10 bg-[#0b0b0d] flex items-center gap-2" id="leader-hd-tabs"></div>
      <div id="leader-hd-stage" class="flex-1 overflow-auto bg-[#111318] py-8 px-6 flex justify-center items-start">
        <div class="text-zinc-500 text-sm">正在读取高清原图…</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#leader-hd-close').onclick=()=>overlay.classList.add('hidden');
  overlay.querySelector('#leader-hd-prev').onclick=()=>showIndex(Math.max(0,currentIndex-1));
  overlay.querySelector('#leader-hd-next').onclick=()=>showIndex(Math.min(pages.length-1,currentIndex+1));
  document.addEventListener('keydown',(e)=>{
    if(overlay.classList.contains('hidden'))return;
    if(e.key==='Escape')overlay.classList.add('hidden');
    if(e.key==='ArrowLeft')showIndex(Math.max(0,currentIndex-1));
    if(e.key==='ArrowRight')showIndex(Math.min(pages.length-1,currentIndex+1));
  });
  return overlay;
}

async function showIndex(index){
  if(!pages.length)return;
  currentIndex=Math.max(0,Math.min(index,pages.length-1));
  const page=pages[currentIndex];
  const overlay=ensureOverlay();
  const stage=overlay.querySelector('#leader-hd-stage');
  const subtitle=overlay.querySelector('#leader-hd-subtitle');
  const prev=overlay.querySelector('#leader-hd-prev');
  const next=overlay.querySelector('#leader-hd-next');
  const tabs=overlay.querySelector('#leader-hd-tabs');
  prev.disabled=currentIndex===0; next.disabled=currentIndex===pages.length-1;
  tabs.innerHTML=pages.map((p,i)=>`<button data-i="${i}" class="px-3 py-1.5 rounded-lg text-xs border ${i===currentIndex?'bg-indigo-500/20 border-indigo-400 text-indigo-200':'bg-white/5 border-white/10 text-zinc-400'}">P${p.page}</button>`).join('');
  tabs.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>showIndex(Number(btn.dataset.i)));
  subtitle.textContent=`P${page.page} · Google Drive 原始高清文件 · 审核时请查看完整画面与文字细节`;
  stage.innerHTML='<div class="text-zinc-500 text-sm">正在读取高清原图…</div>';
  try{
    const url=await urlFor(page.fileId);
    const img=new Image();
    img.alt=`Demo P${page.page} 高清原图`;
    img.className='block bg-white shadow-2xl';
    img.style.width='1242px';
    img.style.maxWidth='none';
    img.style.height='auto';
    img.src=url;
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('IMAGE_DECODE_FAILED'))});
    stage.replaceChildren(img);
  }catch(error){
    stage.innerHTML=`<div class="max-w-xl text-center text-rose-300 text-sm">高清原图加载失败：${esc(error instanceof Error?error.message:String(error))}</div>`;
  }
}

async function openReview(startPage=1){
  await loadPages();
  if(!pages.length)throw new Error('NO_READY_DEMO_PAGES');
  const overlay=ensureOverlay();
  overlay.classList.remove('hidden');
  const index=Math.max(0,pages.findIndex(p=>p.page===Number(startPage)));
  await showIndex(index<0?0:index);
}

function installButton(){
  const host=document.getElementById('requester-demo-view-v12');
  if(!host||document.getElementById('leader-demo-hd-review-btn'))return false;
  const header=host.firstElementChild;
  if(!header)return false;
  const actions=header.querySelector('.flex.items-center.gap-2.shrink-0')||header;
  const btn=document.createElement('button');
  btn.id='leader-demo-hd-review-btn';
  btn.className='text-xs px-3 py-2 rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 font-bold';
  btn.textContent='进入高清审核模式';
  btn.onclick=()=>openReview(1).catch(e=>window.showToast?.('高清审核打开失败',e.message,'error'));
  actions.appendChild(btn);
  return true;
}

export function bootstrapLeaderDemoHdReviewV1(clientInstance){
  if((location.pathname.split('/').pop()||'')!=='task-detail-requester.html')return;
  if(!isLeaderUser(currentUser()))return;
  if(window.__leaderDemoHdReviewV1)return;
  window.__leaderDemoHdReviewV1=true;
  client=clientInstance;
  taskId=String(new URLSearchParams(location.search).get('id')||'').trim();
  if(!taskId)return;
  window.openLeaderDemoHdReview=(page=1)=>openReview(page);
  const timer=setInterval(()=>{if(installButton())clearInterval(timer)},300);
  setTimeout(()=>clearInterval(timer),15000);
  document.addEventListener('click',(event)=>{
    const card=event.target.closest?.('#version-history-container .cursor-pointer');
    if(!card)return;
    const text=card.closest('.bg-\\[\\#16161d\\]')?.textContent||'';
    if(!text.includes('框架方案'))return;
    event.preventDefault();event.stopImmediatePropagation();
    openReview(1).catch(()=>{});
  },true);
  window.addEventListener('beforeunload',()=>{for(const url of objectUrls.values())URL.revokeObjectURL(url);objectUrls.clear()},{once:true});
}
