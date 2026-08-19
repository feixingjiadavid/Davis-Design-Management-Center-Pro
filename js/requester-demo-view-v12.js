import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=requester-demo-view-v12';

let supabase = null;
let taskId = '';
let syncing = false;
let timer = null;
let lastSnapshot = '';
const objectUrls = new Map();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function currentTaskId() {
  return String(new URLSearchParams(location.search).get('id') || '').trim();
}

function hideLegacyDemoBlocks() {
  const ids = ['requester-demo-review-v10', 'requester-demo-review-v11', 'requester-drive-demo-gallery-v7'];
  ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    }
  });
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;
  content.querySelectorAll('button[onclick*="confirmAiDemo"], [data-v8-confirm-demo], [data-requester-confirm-demo], [data-confirm-initial-draft]').forEach((node) => node.remove());
  [...content.querySelectorAll('p')].filter((p) => p.textContent?.trim() === 'Demo 版本').forEach((p) => {
    const block = p.parentElement;
    if (block) block.style.display = 'none';
  });
}

function ensureHost() {
  const anchor = document.getElementById('ai-requirement-panel');
  if (!anchor) return null;
  let host = document.getElementById('requester-demo-view-v12');
  if (host) return host;
  host = document.createElement('section');
  host.id = 'requester-demo-view-v12';
  host.className = 'bg-[#121217] border border-white/10 rounded-2xl p-7 relative overflow-hidden';
  anchor.insertAdjacentElement('afterend', host);
  return host;
}

function outputOf(row) {
  if (row?.output && typeof row.output === 'object') return row.output;
  try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; }
}

async function loadRows() {
  const { data, error } = await supabase.from('uat_design_generations')
    .select('*')
    .eq('task_id', taskId)
    .eq('kind', 'demo')
    .eq('model', DEMO_MODEL)
    .eq('prompt_version', DEMO_VERSION)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return selectCurrentDemoPages(data || []);
}

async function loadTask() {
  const { data, error } = await supabase.from('test_tasks')
    .select('id,status,summary_desc,creator,assignee')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return data;
}

function readyRows(rows) {
  return (rows || [])
    .filter((row) => ['ready', 'confirmed'].includes(String(row.status)))
    .sort((a, b) => Number(a.page_index || 1) - Number(b.page_index || 1));
}

function totalPages(rows) {
  return Math.max(3, ...(rows || []).map((row) => Number(row.page_count || 0)));
}

function snapshotOf(task, rows) {
  return JSON.stringify({
    status: task?.status || '',
    pages: rows.map((row) => ({
      id: row.id,
      page: row.page_index,
      status: row.status,
      drive: outputOf(row).drive_file_id || '',
    })),
  });
}

function statusCopy(status) {
  if (status === 'pending_approval') return '待领导审核框架方案';
  if (status === 'processing') return '领导已通过 · 正稿制作中';
  if (status === 'rejected') return '领导已驳回 · 等待修改';
  if (status === 'reviewing') return '正式稿待需求方验收';
  return '框架方案处理中';
}

function renderShell(host, task, rows) {
  const ready = readyRows(rows);
  const total = totalPages(rows);
  host.innerHTML = `
    <div class="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 class="text-base font-bold text-white">框架方案（Demo）</h3>
        <p class="text-xs text-zinc-500 mt-1">需求方仅查看；框架方案由领导按正式流程审批。</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">${ready.length}/${total} 已归档</span>
        <span class="text-xs px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">${esc(statusCopy(task?.status))}</span>
      </div>
    </div>
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${ready.map((row) => {
        const page = Number(row.page_index || 1);
        const out = outputOf(row);
        const fileId = String(out.drive_file_id || '').trim();
        const driveUrl = String(out.drive_url || '').trim();
        return `<article data-demo-page="${page}" class="rounded-xl overflow-hidden border border-white/10 bg-[#0d1220]">
          <div class="px-3 py-2 flex justify-between items-center text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div>
          <div data-drive-preview="${esc(fileId)}" class="min-h-[260px] flex items-center justify-center text-xs text-slate-500 px-4 text-center">正在读取云盘原图…</div>
          <div class="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 flex justify-between gap-3"><span>Seedream 4.0 · 1242×1660</span>${driveUrl ? `<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="text-blue-400">打开云盘原图 ↗</a>` : ''}</div>
        </article>`;
      }).join('') || '<div class="col-span-full py-10 text-center text-sm text-zinc-500">暂无可查看的框架方案。</div>'}
    </div>`;
  return ready;
}

async function getPreviewUrl(fileId) {
  if (objectUrls.has(fileId)) return objectUrls.get(fileId);
  const url = await getDrivePreviewObjectUrl(supabase, fileId);
  objectUrls.set(fileId, url);
  return url;
}

async function hydrate(host, rows) {
  for (const row of rows) {
    const page = Number(row.page_index || 1);
    const fileId = String(outputOf(row).drive_file_id || '').trim();
    const slot = host.querySelector(`[data-demo-page="${page}"] [data-drive-preview]`);
    if (!slot || !fileId) continue;
    try {
      const url = await getPreviewUrl(fileId);
      const img = new Image();
      img.alt = `Demo ${page}`;
      img.className = 'w-full block object-contain bg-white cursor-zoom-in';
      img.src = url;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED')); });
      img.onclick = () => typeof window.openPreview === 'function' ? window.openPreview(url) : window.open(url, '_blank', 'noopener');
      slot.replaceChildren(img);
      slot.className = 'bg-white';
    } catch (error) {
      slot.className = 'min-h-[220px] flex items-center justify-center text-xs text-rose-300 px-4 text-center';
      slot.textContent = `云盘预览加载失败：${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

async function sync(force = false) {
  if (syncing || !supabase || !taskId) return;
  syncing = true;
  try {
    hideLegacyDemoBlocks();
    const [task, rows] = await Promise.all([loadTask(), loadRows()]);
    const host = ensureHost();
    if (!host) return;
    const snapshot = snapshotOf(task, rows);
    if (!force && snapshot === lastSnapshot && host.firstElementChild) return;
    lastSnapshot = snapshot;
    const ready = renderShell(host, task, rows);
    await hydrate(host, ready);
    hideLegacyDemoBlocks();
  } catch (error) {
    const host = ensureHost();
    if (host && !host.firstElementChild) host.innerHTML = `<div class="text-sm text-rose-300">框架方案加载失败：${esc(error instanceof Error ? error.message : String(error))}</div>`;
  } finally {
    syncing = false;
  }
}

export function bootstrapRequesterDemoViewV12(client) {
  if (window.__requesterDemoViewV12Started) return;
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  window.__requesterDemoViewV12Started = true;
  supabase = client;
  taskId = currentTaskId();
  hideLegacyDemoBlocks();
  sync(true);
  timer = setInterval(() => sync(false), 5000);
  window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });
}
