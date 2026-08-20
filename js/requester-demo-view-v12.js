import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=requester-demo-view-v12c';
import { createLazyPreviewQueue } from './lazy-drive-preview-v1.js?v=all-stages-lazy-v1';

let supabase = null;
let taskId = '';
let syncing = false;
let timer = null;
let lastSnapshot = '';
let lazy = null;
const objectUrls = new Map();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const currentTaskId = () => String(new URLSearchParams(location.search).get('id') || '').trim();
const currentUser = () => { try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); } catch { return {}; } };
const isLeaderView = () => String(currentUser().enName || '').toLowerCase() === 'judyzzhang' || String(currentUser().account_type || '').toLowerCase() === 'uat_leader';

function ensureReadOnlyCss() {
  if (document.getElementById('requester-demo-readonly-css-v12')) return;
  const style = document.createElement('style');
  style.id = 'requester-demo-readonly-css-v12';
  style.textContent = `button[onclick*="confirmAiDemo"],[data-v8-confirm-demo],[data-requester-confirm-demo],[data-confirm-initial-draft]{display:none!important}#requester-demo-review-v10,#requester-demo-review-v11,#requester-drive-demo-gallery-v7{display:none!important}`;
  document.head.appendChild(style);
}

function hideLegacyDemoBlocks() {
  ensureReadOnlyCss();
  ['requester-demo-review-v10', 'requester-demo-review-v11', 'requester-drive-demo-gallery-v7'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) { node.style.display = 'none'; node.setAttribute('aria-hidden', 'true'); }
  });
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;
  content.querySelectorAll('button[onclick*="confirmAiDemo"], [data-v8-confirm-demo], [data-requester-confirm-demo], [data-confirm-initial-draft]').forEach((node) => node.remove());
  [...content.querySelectorAll('p')].filter((p) => p.textContent?.trim() === 'Demo 版本').forEach((p) => { const block = p.parentElement; if (block) block.style.display = 'none'; });
}

function ensureHost() {
  const anchor = document.getElementById('ai-requirement-panel');
  if (!anchor) return null;
  let host = document.getElementById('requester-demo-view-v12');
  if (!host) {
    host = document.createElement('section');
    host.id = 'requester-demo-view-v12';
    host.className = 'bg-[#121217] border border-white/10 rounded-2xl p-7 relative overflow-hidden';
    anchor.insertAdjacentElement('afterend', host);
  }
  host.style.removeProperty('display');
  host.removeAttribute('aria-hidden');
  return host;
}

function outputOf(row) { if (row?.output && typeof row.output === 'object') return row.output; try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; } }
async function loadRows() { const { data, error } = await supabase.from('uat_design_generations').select('*').eq('task_id', taskId).eq('kind', 'demo').eq('model', DEMO_MODEL).eq('prompt_version', DEMO_VERSION).order('created_at', { ascending: true }); if (error) throw error; return selectCurrentDemoPages(data || []); }
async function loadTask() { const { data, error } = await supabase.from('test_tasks').select('id,status,summary_desc,creator,assignee').eq('id', taskId).single(); if (error) throw error; return data; }
async function loadTemplate() { const { data, error } = await supabase.from('uat_framework_templates').select('id,framework_version,approved_by_label,approved_at').eq('task_id', taskId).maybeSingle(); if (error) throw error; return data || null; }
const readyRows = (rows) => (rows || []).filter((row) => ['ready', 'confirmed'].includes(String(row.status))).sort((a, b) => Number(a.page_index || 1) - Number(b.page_index || 1));
const totalPages = (rows) => Math.max(3, ...(rows || []).map((row) => Number(row.page_count || 0)));
const snapshotOf = (task, template, rows) => JSON.stringify({ status: task?.status || '', template: template?.id || '', pages: rows.map((row) => ({ id: row.id, page: row.page_index, status: row.status, drive: outputOf(row).drive_file_id || '' })) });
function statusCopy(status, hasTemplate) { if (status === 'pending_approval') return '待领导审核框架方案'; if (status === 'processing' && hasTemplate) return '母版已通过 · 内容修改中'; if (status === 'processing') return '框架方案处理中'; if (status === 'rejected' && hasTemplate) return '母版已通过 · 待内容修改'; if (status === 'rejected') return '领导已驳回框架 · 等待调整'; if (status === 'reviewing' && hasTemplate) return '母版已通过 · 待需求方验收'; if (status === 'reviewing') return '正式稿待需求方验收'; return '框架方案处理中'; }

function renderShell(host, task, template, rows) {
  const ready = readyRows(rows), total = totalPages(rows), hasTemplate = Boolean(template?.id);
  const subtitle = hasTemplate ? (isLeaderView() ? '该 Demo 已由领导审核通过并冻结为设计母版；后续内容修改不再进入领导审核。' : '领导已审核并冻结该 Demo 为设计母版；后续只能在母版内修改内容，不能推倒重来。') : (isLeaderView() ? '领导审批视角：请查看框架方案，并使用右侧正式审批面板通过或驳回。' : '需求方查看视角：此阶段仅查看框架方案，不参与审批。');
  host.innerHTML = `<div class="flex items-start justify-between gap-4 mb-5"><div><h3 class="text-base font-bold text-white">框架方案（Demo）</h3><p class="text-xs text-zinc-500 mt-1">${esc(subtitle)} · 历史阶段永久保留，高清图按视口懒加载</p></div><div class="flex items-center gap-2 shrink-0">${hasTemplate ? '<span class="text-xs px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">母版已锁定</span>' : ''}<span class="text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">${ready.length}/${total} 已归档</span><span class="text-xs px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">${esc(statusCopy(task?.status,hasTemplate))}</span></div></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${ready.map((row) => { const page = Number(row.page_index || 1), out = outputOf(row), fileId = String(out.drive_file_id || '').trim(), driveUrl = String(out.drive_url || '').trim(); return `<article data-demo-page="${page}" class="rounded-xl overflow-hidden border border-white/10 bg-[#0d1220]"><div class="px-3 py-2 flex justify-between items-center text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div><div data-drive-preview="${esc(fileId)}" class="min-h-[260px] flex items-center justify-center text-xs text-slate-500 px-4 text-center">进入视口后读取 Demo 高清原图…</div><div class="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 flex justify-between gap-3"><span>Seedream 4.0 · 1242×1660</span>${driveUrl ? `<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="text-blue-400">打开云盘原图 ↗</a>` : ''}</div></article>`; }).join('') || '<div class="col-span-full py-10 text-center text-sm text-zinc-500">暂无可查看的框架方案。</div>'}</div>`;
  return ready;
}

async function getPreviewUrl(fileId) { if (objectUrls.has(fileId)) return objectUrls.get(fileId); const url = await getDrivePreviewObjectUrl(supabase, fileId); objectUrls.set(fileId, url); return url; }
function installLazy() {
  if (lazy) return;
  lazy = createLazyPreviewQueue({ rootMargin: '1200px 0px', concurrency: 2, hydrate: async (slot, { fileId, page }) => { const url = await getPreviewUrl(fileId); const img = new Image(); img.alt = `Demo ${page}`; img.className = 'w-full block object-contain bg-white cursor-zoom-in'; img.loading = 'lazy'; img.decoding = 'async'; img.src = url; await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED')); }); img.onclick = () => typeof window.openPreview === 'function' ? window.openPreview(url) : window.open(url, '_blank', 'noopener'); slot.replaceChildren(img); slot.className = 'bg-white'; } });
}
function bindLazy(host, rows) {
  installLazy();
  for (const row of rows) {
    const page = Number(row.page_index || 1), fileId = String(outputOf(row).drive_file_id || '').trim();
    const slot = host.querySelector(`[data-demo-page="${page}"] [data-drive-preview]`);
    if (!slot || !fileId) continue;
    slot.addEventListener('lazy-preview-error', (event) => { slot.className = 'min-h-[220px] flex items-center justify-center text-xs text-rose-300 px-4 text-center'; slot.textContent = `云盘预览加载失败：${event.detail instanceof Error ? event.detail.message : String(event.detail)}`; }, { once: true });
    lazy.observe(slot, { fileId, page });
  }
}

async function sync(force = false) {
  if (syncing || !supabase || !taskId || document.hidden) return;
  syncing = true;
  try {
    hideLegacyDemoBlocks();
    const [task, template, rows] = await Promise.all([loadTask(), loadTemplate(), loadRows()]);
    const host = ensureHost();
    if (!host) return;
    const snapshot = snapshotOf(task, template, rows);
    if (!force && snapshot === lastSnapshot && host.firstElementChild) return;
    lastSnapshot = snapshot;
    const ready = renderShell(host, task, template, rows);
    bindLazy(host, ready);
    hideLegacyDemoBlocks();
  } catch (error) {
    const host = ensureHost();
    if (host && !host.firstElementChild) host.innerHTML = `<div class="text-sm text-rose-300">框架方案加载失败：${esc(error instanceof Error ? error.message : String(error))}</div>`;
  } finally { syncing = false; }
}

export function bootstrapRequesterDemoViewV12(client) {
  if (window.__requesterDemoViewV12Started) return;
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  window.__requesterDemoViewV12Started = true;
  supabase = client;
  taskId = currentTaskId();
  ensureReadOnlyCss();
  hideLegacyDemoBlocks();
  sync(true);
  timer = setInterval(() => { if (!document.hidden) sync(false); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(true); });
  window.addEventListener('beforeunload', () => { clearInterval(timer); lazy?.disconnect(); }, { once: true });
}
