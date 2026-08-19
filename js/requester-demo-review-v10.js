import { DEMO_MODEL, DEMO_VERSION, getDrivePreviewObjectUrl, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs?v=requester-demo-review-v11';

let supabase = null;
let taskId = '';
let syncing = false;
let heartbeat = null;
let lastSnapshot = '';
const driveObjectUrls = new Map();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function currentTaskId() {
  return String(new URLSearchParams(location.search).get('id') || '').trim();
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); } catch { return {}; }
}

function removeLegacyDemoUI() {
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;
  content.querySelectorAll('button[onclick*="confirmAiDemo"], [data-v8-confirm-demo], [data-requester-confirm-demo]').forEach((node) => node.remove());
  const old = document.getElementById('requester-drive-demo-gallery-v7');
  if (old) old.style.display = 'none';
  [...content.querySelectorAll('p')].filter((p) => p.textContent?.trim() === 'Demo 版本').forEach((p) => {
    const block = p.parentElement;
    if (block) block.style.display = 'none';
  });
}

function ensureHost() {
  const anchor = document.getElementById('ai-requirement-panel');
  if (!anchor) return null;
  let host = document.getElementById('requester-demo-review-v10');
  if (host) return host;
  host = document.createElement('section');
  host.id = 'requester-demo-review-v10';
  host.className = 'bg-[#121217] border border-emerald-500/20 rounded-2xl p-7 relative overflow-hidden';
  anchor.insertAdjacentElement('afterend', host);
  return host;
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
    .select('id,status,summary_desc,history_json,creator,assignee')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return data;
}

function outputOf(row) {
  if (row?.output && typeof row.output === 'object') return row.output;
  try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; }
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
    pages: (rows || []).map((row) => ({
      id: row.id,
      page: Number(row.page_index || 1),
      status: row.status,
      drive: String(outputOf(row).drive_file_id || ''),
    })),
  });
}

function statusCopy(status) {
  if (status === 'pending_approval') return '等待领导审核';
  if (status === 'processing') return '框架已通过 · 正稿制作中';
  if (status === 'rejected') return '框架方案已被驳回';
  if (status === 'reviewing') return '正式稿待需求方验收';
  return '初稿方案待需求方确认';
}

function shell(host, task, rows) {
  const ready = readyRows(rows);
  const total = totalPages(rows);
  const showConfirm = task?.status === 'demo_review' && ready.length >= total;

  host.innerHTML = `
    <div class="flex items-start justify-between gap-5 mb-5">
      <div>
        <h3 class="text-base font-bold text-white">Demo 方案验收</h3>
        <p class="text-xs text-zinc-500 mt-1">初稿方案 · Google Drive 持久化版本</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span class="text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">${ready.length}/${total} 已归档</span>
        <span class="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-300">${esc(statusCopy(task?.status))}</span>
        ${showConfirm ? `<button data-confirm-initial-draft disabled class="px-4 py-2.5 rounded-xl bg-emerald-600/40 text-white/50 font-bold cursor-wait">正在验证方案…</button>` : ''}
      </div>
    </div>
    <div data-demo-review-grid class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${ready.map((row) => {
        const page = Number(row.page_index || 1);
        const o = outputOf(row);
        const fid = String(o.drive_file_id || '').trim();
        const drive = String(o.drive_url || '').trim();
        return `<article data-demo-review-page="${page}" class="rounded-xl overflow-hidden border border-white/10 bg-[#0d1220]">
          <div class="px-3 py-2 flex items-center justify-between text-[11px]"><span class="font-bold text-white">Demo ${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span class="text-emerald-400">Google Drive 已归档</span></div>
          <div data-demo-review-preview="${esc(fid)}" class="min-h-[260px] flex items-center justify-center px-4 text-center text-xs text-slate-500">正在读取云盘原图…</div>
          <div class="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 flex justify-between gap-3"><span>Seedream 4.0 · 1242×1660</span>${drive ? `<a href="${esc(drive)}" target="_blank" rel="noopener" class="text-blue-400">打开云盘原图 ↗</a>` : ''}</div>
        </article>`;
      }).join('') || '<div class="col-span-full py-10 text-center text-sm text-zinc-500">暂无可验收 Demo。</div>'}
    </div>`;

  return { ready, total };
}

async function getCachedDriveUrl(fileId) {
  if (driveObjectUrls.has(fileId)) return driveObjectUrls.get(fileId);
  const url = await getDrivePreviewObjectUrl(supabase, fileId);
  driveObjectUrls.set(fileId, url);
  return url;
}

async function hydrate(host, rows, total, task) {
  let visible = 0;
  let failed = 0;
  const ready = readyRows(rows);

  for (const row of ready) {
    const o = outputOf(row);
    const fid = String(o.drive_file_id || '').trim();
    const slot = host.querySelector(`[data-demo-review-page="${Number(row.page_index || 1)}"] [data-demo-review-preview]`);
    if (!slot || !fid) { failed += 1; continue; }

    try {
      const url = await getCachedDriveUrl(fid);
      const img = new Image();
      img.alt = `Demo ${Number(row.page_index || 1)}`;
      img.className = 'w-full block object-contain bg-white cursor-zoom-in';
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      });
      img.onclick = () => typeof window.openPreview === 'function' ? window.openPreview(url) : window.open(url, '_blank', 'noopener');
      slot.replaceChildren(img);
      slot.className = 'bg-white';
      visible += 1;
    } catch (error) {
      failed += 1;
      slot.className = 'min-h-[220px] flex items-center justify-center px-4 text-center text-xs text-rose-300';
      slot.textContent = `云盘预览加载失败：${error instanceof Error ? error.message : String(error)}`;
    }
  }

  const button = host.querySelector('[data-confirm-initial-draft]');
  if (!button) return;

  if (task?.status === 'demo_review' && ready.length >= total && visible >= total && failed === 0) {
    button.disabled = false;
    button.className = 'px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold btn-press transition-all';
    button.textContent = '确认初稿方案';
    button.onclick = () => requestInitialDraftConfirmation();
  } else {
    button.disabled = true;
    button.className = 'px-4 py-2.5 rounded-xl bg-zinc-700 text-zinc-500 font-bold cursor-not-allowed';
    button.textContent = failed ? '方案预览异常' : '方案加载中';
  }
}

function nextFormalVersion(history) {
  let max = 0;
  for (const item of history || []) {
    if (!['submit_framework', 'submit_draft'].includes(item?.action)) continue;
    const match = String(item.version || '').match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

async function handoffToFormalFrameworkApproval() {
  const task = await loadTask();
  if (task.status === 'pending_approval') {
    window.showToast?.('已提交领导审核', '当前初稿已经进入正式框架审批流程。', 'info');
    lastSnapshot = '';
    await sync(true);
    return;
  }
  if (task.status !== 'demo_review') {
    window.showToast?.('状态已变化', `当前状态为 ${task.status}，请按正式流程继续处理。`, 'info');
    lastSnapshot = '';
    await sync(true);
    return;
  }

  const rows = await loadRows();
  const ready = readyRows(rows);
  const total = totalPages(rows);
  const complete = ready.length >= total && ready.every((row) => String(outputOf(row).drive_file_id || '').trim());
  if (!complete) throw new Error('初稿方案尚未完整归档，暂不能提交领导审核');

  let history = [];
  try { history = JSON.parse(task.history_json || '[]'); } catch { history = []; }
  const versionNum = nextFormalVersion(history);
  const user = currentUser();
  const requesterName = user.displayName || user.cnName || user.enName || task.creator || '需求方';
  const firstDriveUrl = String(outputOf(ready[0]).drive_url || '').trim();

  history.push({
    action: 'submit_framework',
    operator: 'davis.design.ai',
    version: `v-${versionNum}`,
    desc: '需求方已确认初稿方案，提交领导进行框架大方向审核。',
    img_url: '',
    source_link: firstDriveUrl,
    work_hours: 0,
    ai_tools: ['Seedream 4.0'],
    created_at: new Date().toISOString(),
    requester_confirmed_by: `${requesterName} (需求方)`,
    ai_demo_generation_ids: ready.map((row) => row.id),
    drive_file_ids: ready.map((row) => String(outputOf(row).drive_file_id || '')),
  });

  const { error } = await supabase.from('test_tasks').update({
    status: 'pending_approval',
    summary_desc: `框架已上传，待领导审批 (版本: v-${versionNum})`,
    history_json: JSON.stringify(history),
  }).eq('id', taskId);
  if (error) throw error;

  const ids = ready.map((row) => row.id).filter(Boolean);
  if (ids.length) {
    const { error: generationError } = await supabase.from('uat_design_generations')
      .update({ status: 'confirmed' })
      .in('id', ids);
    if (generationError) console.warn('Demo confirmation state sync failed:', generationError);
  }

  window.showToast?.('初稿方案已确认', '已按正式流程提交领导审核框架方案。', 'success');
  lastSnapshot = '';
  await sync(true);
  if (typeof window.renderAiRequirementPanel === 'function') window.renderAiRequirementPanel();
  setTimeout(() => location.reload(), 700);
}

function requestInitialDraftConfirmation() {
  const run = async () => {
    try {
      await handoffToFormalFrameworkApproval();
    } catch (error) {
      window.showToast?.('提交失败', error instanceof Error ? error.message : String(error), 'error');
    }
  };

  if (typeof window.showConfirm === 'function') {
    window.showConfirm('确认初稿方案', '确认当前初稿方案符合需求，并提交领导审核框架方案？', run, 'success');
  } else if (window.confirm('确认当前初稿方案符合需求，并提交领导审核框架方案？')) {
    run();
  }
}

async function sync(force = false) {
  if (syncing || !supabase || !taskId) return;
  syncing = true;
  try {
    removeLegacyDemoUI();
    const [task, rows] = await Promise.all([loadTask(), loadRows()]);
    const host = ensureHost();
    if (!host) return;
    const snapshot = snapshotOf(task, rows);

    if (!force && snapshot === lastSnapshot && host.firstElementChild) {
      removeLegacyDemoUI();
      return;
    }

    lastSnapshot = snapshot;
    const { total } = shell(host, task, rows);
    await hydrate(host, rows, total, task);
    removeLegacyDemoUI();
  } catch (error) {
    const host = ensureHost();
    if (host && !host.firstElementChild) host.innerHTML = `<div class="text-sm text-rose-300">Demo 验收区加载失败：${esc(error instanceof Error ? error.message : String(error))}</div>`;
  } finally {
    syncing = false;
  }
}

export function bootstrapRequesterDemoReviewV10(client) {
  if (window.__requesterDemoReviewStableStarted) return;
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  window.__requesterDemoReviewStableStarted = true;
  supabase = client;
  taskId = currentTaskId();

  // 兼容旧按钮：任何旧缓存按钮即使短暂出现，也只会进入正式框架审批，不会直接生成收费成品。
  window.confirmAiDemo = () => requestInitialDraftConfirmation();

  removeLegacyDemoUI();
  sync(true);
  heartbeat = setInterval(() => sync(false), 5000);
  window.addEventListener('beforeunload', () => clearInterval(heartbeat), { once: true });
}
