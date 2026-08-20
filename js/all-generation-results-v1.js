import { getDrivePreviewObjectUrl } from './seedream-drive-preview-client.mjs?v=drive-preview-v8-current-uat';
import { createLazyPreviewQueue } from './lazy-drive-preview-v1.js?v=all-stages-lazy-v1';

let sb = null;
let timer = null;
let lazy = null;
let syncing = false;
let lastTaskId = '';
let lastKey = '';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));

const pageName = () => location.pathname.split('/').pop() || '';

function currentTaskId() {
  if (pageName() === 'task-detail-requester.html') {
    return String(new URLSearchParams(location.search).get('id') || '').trim();
  }
  if (pageName() === 'ai-designer-workspace.html') {
    return String(document.querySelector('#taskList .task.active')?.dataset?.id || '').trim();
  }
  return '';
}

function outputOf(row) {
  if (row?.output && typeof row.output === 'object') return row.output;
  try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; }
}

function modelLabel(model) {
  const value = String(model || '');
  if (/seedream-4-0/i.test(value)) return 'Seedream 4.0';
  if (/seedream-4-5/i.test(value)) return 'Seedream 4.5';
  if (/seedream-5(?:-|_)0|seedream-5/i.test(value)) return 'Seedream 5.0';
  return value || '未知模型';
}

function statusMeta(status, hasImage) {
  const value = String(status || '');
  if (['ready','confirmed'].includes(value)) return { text:'已生成', cls:'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' };
  if (value === 'cancelled' && hasImage) return { text:'历史结果', cls:'text-amber-300 border-amber-500/20 bg-amber-500/10' };
  if (value === 'failed') return { text:'生成失败', cls:'text-rose-300 border-rose-500/20 bg-rose-500/10' };
  if (['queued','generating'].includes(value)) return { text:value === 'queued' ? '排队中' : '生成中', cls:'text-blue-300 border-blue-500/20 bg-blue-500/10' };
  return { text:value || '未知状态', cls:'text-zinc-400 border-white/10 bg-white/5' };
}

function groupInfo(row) {
  const out = outputOf(row);
  const rev = Number(out.revision_no || 0);
  const model = modelLabel(row.model || out.selected_model || out.model);
  if (String(row.kind) === 'demo') {
    return { key:`demo|${model}`, title:`Demo 阶段 · ${model}`, order:0 };
  }
  if (rev > 0) {
    return { key:`revision-${rev}|${model}`, title:`第 ${rev} 次内容修改 · ${model}`, order:100 + rev };
  }
  return { key:`final|${model}`, title:`正式生成阶段 · ${model}`, order:50 };
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const info = groupInfo(row);
    if (!groups.has(info.key)) groups.set(info.key, { ...info, rows:[] });
    groups.get(info.key).rows.push(row);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, rows:group.rows.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)) }))
    .sort((a,b) => a.order - b.order || String(a.title).localeCompare(String(b.title)));
}

function ensureHost() {
  let host = document.getElementById('all-generation-results-v1');
  if (host) return host;
  host = document.createElement('section');
  host.id = 'all-generation-results-v1';
  if (pageName() === 'task-detail-requester.html') {
    host.className = 'bg-[#121217] border border-white/10 rounded-2xl p-7 relative overflow-hidden';
    const anchor = document.getElementById('version-history-block') || document.getElementById('requester-delivery-view-v13') || document.getElementById('ai-requirement-panel');
    if (!anchor) return null;
    anchor.insertAdjacentElement('afterend', host);
    return host;
  }
  if (pageName() === 'ai-designer-workspace.html') {
    host.className = 'glass rounded-2xl p-5 lg:p-7 mt-6';
    const detail = document.getElementById('detail');
    const grid = detail?.parentElement;
    if (!grid) return null;
    grid.insertAdjacentElement('afterend', host);
    return host;
  }
  return null;
}

async function hydrateImage(slot, { fileId, pageIndex }) {
  const url = await getDrivePreviewObjectUrl(sb, fileId);
  const img = new Image();
  img.src = url;
  img.alt = `P${pageIndex} 历史生成结果`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'w-full h-full object-contain bg-white cursor-zoom-in';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
  });
  img.onclick = () => typeof window.openPreview === 'function' ? window.openPreview(url) : window.open(url, '_blank', 'noopener');
  slot.replaceChildren(img);
  slot.className = 'aspect-[3/4] bg-white overflow-hidden';
}

function installLazy() {
  if (lazy) return;
  lazy = createLazyPreviewQueue({
    rootMargin:'900px 0px',
    concurrency:2,
    hydrate:hydrateImage,
  });
}

function cardHtml(row) {
  const out = outputOf(row);
  const fileId = String(out.drive_file_id || '').trim();
  const pageIndex = Math.max(1, Number(row.page_index || out.page_index || 1));
  const meta = statusMeta(row.status, Boolean(fileId));
  const driveUrl = String(out.drive_url || '').trim();
  const runId = String(out.run_id || '').trim();
  const when = row.updated_at || row.created_at || '';
  return `<article class="rounded-xl overflow-hidden border border-white/10 bg-black/20" data-generation-id="${esc(row.id)}">
    <div class="px-3 py-2 flex items-center justify-between gap-2 text-[11px] border-b border-white/5">
      <span class="font-bold text-white">P${pageIndex}</span>
      <span class="px-2 py-0.5 rounded-full border ${meta.cls}">${esc(meta.text)}</span>
    </div>
    ${fileId
      ? `<div data-all-generation-file="${esc(fileId)}" data-page-index="${pageIndex}" class="aspect-[3/4] flex items-center justify-center bg-[#0d1220] text-[11px] text-zinc-500 px-3 text-center">进入视口后读取该次生成结果…</div>`
      : `<div class="aspect-[3/4] flex items-center justify-center bg-[#0d1220] text-[11px] text-zinc-500 px-4 text-center">本次尝试未产生可归档图片<br>${esc(String(row.status || ''))}</div>`}
    <div class="px-3 py-2.5 border-t border-white/5 space-y-1 text-[10px] text-zinc-500">
      <div class="flex justify-between gap-2"><span>${esc(modelLabel(row.model || out.model))}</span><span>${when ? esc(new Date(when).toLocaleString()) : ''}</span></div>
      ${runId ? `<p class="truncate" title="${esc(runId)}">run: ${esc(runId)}</p>` : ''}
      ${driveUrl ? `<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="inline-block text-blue-400 hover:text-blue-300">打开 Google Drive 归档 ↗</a>` : ''}
    </div>
  </article>`;
}

function render(rows, taskId) {
  const host = ensureHost();
  if (!host) return;
  const groups = groupRows(rows);
  const actualImageCount = rows.filter((row) => String(outputOf(row).drive_file_id || '').trim()).length;
  host.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-4 mb-5">
    <div><h3 class="text-base font-bold text-white">全阶段生成结果</h3><p class="text-xs text-zinc-500 mt-1">Demo、每次修改、模型升级和历史尝试全部保留；仅图片加载采用视口懒加载，不隐藏任何阶段。</p></div>
    <span class="text-xs px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">${actualImageCount} 个已归档图 · ${rows.length} 条生成记录</span>
  </div>
  <div class="space-y-6">${groups.map((group) => `
    <section class="rounded-xl border border-white/10 bg-white/[0.025] p-4" data-generation-group="${esc(group.key)}">
      <div class="flex items-center justify-between gap-3 mb-4"><h4 class="text-sm font-bold text-white">${esc(group.title)}</h4><span class="text-[10px] text-zinc-500">${group.rows.length} 条</span></div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">${group.rows.map(cardHtml).join('')}</div>
    </section>`).join('') || '<div class="py-8 text-center text-sm text-zinc-500">暂无生成记录。</div>'}</div>`;
  host.dataset.taskId = taskId;
  installLazy();
  host.querySelectorAll('[data-all-generation-file]').forEach((slot) => {
    const fileId = String(slot.dataset.allGenerationFile || '').trim();
    const pageIndex = Number(slot.dataset.pageIndex || 1);
    if (!fileId) return;
    slot.addEventListener('lazy-preview-error', (event) => {
      const error = event.detail;
      slot.className = 'aspect-[3/4] flex items-center justify-center bg-[#0d1220] text-[11px] text-rose-300 px-4 text-center';
      slot.textContent = `图片读取失败：${error instanceof Error ? error.message : String(error)}`;
    }, { once:true });
    lazy.observe(slot, { fileId, pageIndex });
  });
}

function snapshot(rows, taskId) {
  return JSON.stringify({ taskId, rows:rows.map((row) => {
    const out = outputOf(row);
    return [row.id,row.kind,row.page_index,row.model,row.status,row.updated_at,out.drive_file_id,out.run_id,out.revision_no];
  }) });
}

async function sync(force = false) {
  if (!sb || syncing || document.hidden) return;
  const taskId = currentTaskId();
  if (!taskId) return;
  syncing = true;
  try {
    const { data, error } = await sb.from('uat_design_generations')
      .select('id,kind,page_index,page_count,model,prompt_version,status,output,created_at,updated_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending:true });
    if (error) throw error;
    const rows = data || [];
    const key = snapshot(rows, taskId);
    if (force || key !== lastKey || taskId !== lastTaskId || !document.getElementById('all-generation-results-v1')) {
      lastKey = key;
      lastTaskId = taskId;
      render(rows, taskId);
    }
  } catch (error) {
    console.error('全阶段生成结果读取失败:', error);
    const host = ensureHost();
    if (host && !host.firstElementChild) host.innerHTML = `<div class="text-sm text-rose-300">全阶段生成结果读取失败：${esc(error instanceof Error ? error.message : String(error))}</div>`;
  } finally {
    syncing = false;
  }
}

export function bootstrapAllGenerationResultsV1(client) {
  const page = pageName();
  if (!['task-detail-requester.html','ai-designer-workspace.html'].includes(page) || window.__allGenerationResultsV1) return;
  window.__allGenerationResultsV1 = true;
  sb = client;
  const start = () => {
    sync(true);
    timer = setInterval(() => { if (!document.hidden) sync(false); }, 20000);
    if (page === 'ai-designer-workspace.html') {
      document.getElementById('taskList')?.addEventListener('click', (event) => {
        if (!event.target?.closest?.('.task')) return;
        setTimeout(() => sync(true), 250);
      }, true);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(true); });
  window.addEventListener('beforeunload', () => { clearInterval(timer); lazy?.disconnect(); }, { once:true });
}
