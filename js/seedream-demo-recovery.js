export const DEMO_MODEL = 'doubao-seedream-4-0-250828';
export const DEMO_PROMPT_VERSION = 'seedream-demo-design-director-v1';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function deriveSeedreamDemoProgress(task = {}, generations = [], nowMs = Date.now()) {
  const currentRows = (generations || [])
    .filter(row => row?.kind === 'demo' && row?.model === DEMO_MODEL && row?.prompt_version === DEMO_PROMPT_VERSION)
    .sort((a,b) => Number(a.page_index||0)-Number(b.page_index||0) || new Date(a.created_at||0)-new Date(b.created_at||0));
  const totalPages = Math.max(1, ...currentRows.map(row => Number(row.page_count || 1)));
  const completedPages = currentRows.filter(row => ['ready','confirmed'].includes(row.status)).length;
  const failed = [...currentRows].reverse().find(row => row.status === 'failed');
  const generating = currentRows.find(row => row.status === 'generating');
  const startedTimes = currentRows.map(row => Date.parse(row.created_at || '')).filter(Number.isFinite);
  const startedAt = startedTimes.length ? Math.min(...startedTimes) : NaN;
  const elapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((nowMs - startedAt) / 1000)) : 0;
  const currentPage = Number(generating?.page_index || failed?.page_index || Math.min(totalPages, completedPages + 1));

  let state = 'idle';
  if (failed || task.status === 'demo_failed') state = 'failed';
  else if (generating || task.status === 'generating_demo') state = 'generating';
  else if (completedPages >= totalPages && currentRows.length >= totalPages) state = 'ready';
  else if (task.status === 'ready_for_demo') state = 'queued';

  return {
    state,
    currentRows,
    totalPages,
    completedPages,
    currentPage,
    elapsedSeconds,
    error: String(failed?.error_message || (state === 'failed' ? task.summary_desc || 'Demo 生成失败' : '')),
    canRetry: state === 'failed',
  };
}

function activeTaskId() {
  return document.querySelector('.task.active[data-id]')?.dataset?.id || '';
}

function findDemoCard() {
  const detail = document.getElementById('detail');
  if (!detail) return null;
  const heading = [...detail.querySelectorAll('h3')].find(node => node.textContent?.trim() === 'Demo 版本');
  return heading?.parentElement || null;
}

function pagePills(progress) {
  const byPage = new Map(progress.currentRows.map(row => [Number(row.page_index || 0), row]));
  return Array.from({length: progress.totalPages}, (_, offset) => {
    const page = offset + 1;
    const row = byPage.get(page);
    let cls = 'border-white/10 bg-white/[.02] text-slate-500';
    let icon = '○';
    let label = `第 ${page} 页 等待`;
    if (row?.status === 'ready' || row?.status === 'confirmed') { cls='border-emerald-500/25 bg-emerald-950/25 text-emerald-300'; icon='✓'; label=`第 ${page} 页 已完成`; }
    else if (row?.status === 'generating') { cls='border-blue-500/35 bg-blue-950/30 text-blue-200'; icon='●'; label=`第 ${page} 页 生成中`; }
    else if (row?.status === 'failed') { cls='border-rose-500/30 bg-rose-950/25 text-rose-300'; icon='×'; label=`第 ${page} 页 失败`; }
    return `<div class="rounded-lg border ${cls} p-2 text-[11px]">${icon} ${label}</div>`;
  }).join('');
}

function readyImages(progress) {
  return progress.currentRows
    .filter(row => ['ready','confirmed'].includes(row.status) && row.output?.image_url)
    .map(row => `<div class="rounded-xl border border-white/10 overflow-hidden bg-slate-900"><div class="flex items-center justify-between px-3 py-2 text-[11px] text-slate-400"><span>Demo ${String(row.page_index).padStart(2,'0')} / ${String(row.page_count).padStart(2,'0')}</span><span>${esc(row.output?.target_size || row.output?.requested_size || '')}</span></div><img src="${esc(row.output.image_url)}" class="w-full block" alt="Seedream Demo 第${row.page_index}页"></div>`)
    .join('');
}

function renderProgress(progress, analysis) {
  const target = (analysis?.brief?.dimensions || []).join('、') || '1242×1660';
  if (progress.state === 'generating') {
    const pct = Math.max(6, Math.min(96, Math.round((progress.completedPages / progress.totalPages) * 100 + (progress.currentPage > progress.completedPages ? 10 : 0))));
    return `<div id="seedream-demo-live" class="space-y-4"><div class="flex items-start gap-3"><div class="spin shrink-0"></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm font-bold text-blue-200">Seedream 4.0 · 第 ${progress.currentPage} / ${progress.totalPages} 页生成中</p><span class="text-[11px] text-slate-500">已耗时 ${progress.elapsedSeconds}s</span></div><p class="text-xs text-slate-500 mt-1">请求已发出，页面每 1.5 秒读取 Supabase 的真实生成状态。</p></div></div><div class="h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-blue-500 transition-all duration-500" style="width:${pct}%"></div></div><div class="grid grid-cols-3 gap-2">${pagePills(progress)}</div><div class="text-xs text-slate-500"><p>目标尺寸：<span class="text-slate-300">${esc(target)}</span></p><p class="mt-1">模型：<span class="text-slate-300">Seedream 4.0</span></p></div></div>`;
  }
  if (progress.state === 'failed') {
    return `<div id="seedream-demo-live" class="rounded-xl border border-rose-500/25 bg-rose-950/20 p-5"><div class="flex items-start gap-3"><div class="w-8 h-8 rounded-full border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-rose-300 shrink-0">×</div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-rose-300">Seedream 4.0 Demo 生成失败</p><p class="text-xs text-rose-200/75 mt-2 break-words">${esc(progress.error)}</p><p class="text-[11px] text-slate-500 mt-3">失败版本不会作为 Demo 展示；重新生成只在你点击后触发。</p><button id="seedreamDemoRetryBtn" class="btn bg-violet-600 hover:bg-violet-500 text-white mt-4">重新生成 Seedream 4.0 Demo</button></div></div></div>`;
  }
  if (progress.state === 'ready') {
    return `<div id="seedream-demo-live" class="space-y-4"><div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-emerald-400">Seedream 4.0 Demo 已完成 ${progress.completedPages} / ${progress.totalPages}</p><span class="text-[11px] text-slate-500">耗时约 ${progress.elapsedSeconds}s</span></div><div class="space-y-3">${readyImages(progress)}</div></div>`;
  }
  if (progress.state === 'queued') {
    return `<div id="seedream-demo-live" class="min-h-[190px] flex items-center justify-center"><div class="text-center"><div class="spin mx-auto"></div><p class="text-sm font-bold text-blue-200 mt-3">Seedream 4.0 Demo 等待启动</p><p class="text-xs text-slate-500 mt-1">需求理解已确认，等待进入生成。</p></div></div>`;
  }
  return `<div id="seedream-demo-live" class="h-[190px] flex items-center justify-center text-center text-slate-600">AI 完成需求理解后会自动生成 Demo</div>`;
}

async function loadState(supabase, taskId) {
  const [taskResult, analysisResult, generationResult] = await Promise.all([
    supabase.from('test_tasks').select('id,status,summary_desc').eq('id', taskId).maybeSingle(),
    supabase.from('uat_requirement_analyses').select('id,status,version,brief').eq('task_id', taskId).order('version',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('uat_design_generations').select('id,kind,status,model,prompt_version,page_index,page_count,error_message,created_at,updated_at,output').eq('task_id', taskId).eq('kind','demo').eq('model',DEMO_MODEL).eq('prompt_version',DEMO_PROMPT_VERSION).order('created_at',{ascending:true}),
  ]);
  const error = taskResult.error || analysisResult.error || generationResult.error;
  if (error) throw error;
  return { task: taskResult.data, analysis: analysisResult.data, generations: generationResult.data || [] };
}

export async function bootstrapSeedreamDemoRecovery(supabase) {
  if (!/ai-designer-workspace\.html$/i.test(location.pathname)) return;
  if (window.__seedreamDemoProgressStarted) return;
  window.__seedreamDemoProgressStarted = true;
  for (let attempt=0; attempt<40; attempt+=1) {
    const {data:{session}} = await supabase.auth.getSession();
    if (session) break;
    await sleep(150);
  }

  let busy = false;
  let pollTimer = null;
  const refresh = async () => {
    document.getElementById('seedream-demo-recovery')?.remove();
    const taskId = activeTaskId();
    const card = findDemoCard();
    if (!taskId || !card) return;
    try {
      const state = await loadState(supabase, taskId);
      const progress = deriveSeedreamDemoProgress(state.task, state.generations, Date.now());
      [...card.children].forEach((node,index) => { if (index > 0) node.remove(); });
      card.insertAdjacentHTML('beforeend', renderProgress(progress, state.analysis));
      const retry = card.querySelector('#seedreamDemoRetryBtn');
      if (retry) retry.onclick = async () => {
        if (busy || !state.analysis?.id) return;
        busy = true;
        retry.disabled = true;
        retry.textContent = '请求已发出，等待 Seedream…';
        try {
          const call = supabase.functions.invoke('uat-ai-design', {body:{task_id:taskId,action:'generate_demo',analysis_id:state.analysis.id,idempotency_key:crypto.randomUUID()}});
          clearInterval(pollTimer);
          pollTimer = setInterval(refresh, 1500);
          const {data,error} = await call;
          if (error) throw error;
          if (!data?.ok) throw new Error(data?.error || 'SEEDREAM_DEMO_FAILED');
        } catch (error) {
          console.error('Seedream Demo 生成失败:', error);
        } finally {
          busy = false;
          await refresh();
        }
      };
      clearInterval(pollTimer);
      if (progress.state === 'generating' || progress.state === 'queued') pollTimer = setInterval(refresh, 1500);
    } catch (error) {
      console.error('Seedream Demo 进度读取失败:', error);
    }
  };

  const observer = new MutationObserver(() => {
    clearTimeout(window.__seedreamDemoProgressMutationTimer);
    window.__seedreamDemoProgressMutationTimer = setTimeout(refresh, 120);
  });
  observer.observe(document.getElementById('detail') || document.body, {subtree:true,childList:true});
  await refresh();
}
