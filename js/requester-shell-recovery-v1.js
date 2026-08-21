import { bootstrapRequesterDemoViewV12 } from './requester-demo-view-v12.js?v=requester-formal-versions-v1';

let started = false;
let retryTimer = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '--';
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); }
  catch { return {}; }
}

function renderIdentity(task) {
  const user = currentUser();
  const displayName = user.displayName || user.cnName || user.enName || 'UAT 用户';
  setText('sidebar-name', displayName);
  setText('sidebar-avatar', user.avatar || String(displayName).slice(0, 1) || '?');

  const creator = String(task?.creator || '').toLowerCase();
  const enName = String(user?.enName || '').toLowerCase();
  const display = String(displayName || '').toLowerCase();
  const isCreator = Boolean(creator) && (creator === enName || creator === display);
  const identity = document.getElementById('header-identity-tag');
  const role = document.getElementById('sidebar-role');
  if (identity) identity.textContent = isCreator ? '身份: 需求提单方' : '身份: 只读访问';
  if (role) role.textContent = isCreator ? '需求方' : '只读访问';
}

function renderTask(task) {
  setText('req-id', task.id || '--');
  setText('req-title-display', task.title || '无标题');
  setText('dt-project', task.project || '--');
  setText('dt-date', task.due_date || '--');
  setText('dt-creator', task.creator || '--');
  setText('dt-assignee', task.assignee && task.assignee !== 'none' ? task.assignee : '暂未分配');

  const desc = document.getElementById('req-desc-display');
  if (desc) desc.innerHTML = esc(task.full_desc || '暂无描述').replace(/\n/g, '<br>');

  const badge = document.getElementById('header-status-badge');
  if (badge) {
    const copy = task.status === 'reviewing' ? '当前修改版待验收'
      : task.status === 'processing' ? 'AI 设计师处理中'
      : task.status === 'needs_input' ? '等待需求方补充'
      : String(task.status || '任务进行中');
    badge.textContent = copy;
    badge.className = 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5';
  }

  renderIdentity(task);
}

function renderFailure(message) {
  const title = document.getElementById('req-title-display');
  if (title && /同步需求数据|读取中/.test(String(title.textContent || ''))) title.textContent = '需求详情读取失败';
  const panel = document.getElementById('smart-action-panel');
  if (panel && /初始化|读取/.test(String(panel.textContent || ''))) {
    panel.innerHTML = `<div class="text-center py-5"><p class="text-rose-300 font-bold mb-2">需求页面加载失败</p><p class="text-xs text-zinc-500 mb-4">${esc(message)}</p><button id="requester-shell-retry" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">重新读取</button></div>`;
    panel.querySelector('#requester-shell-retry')?.addEventListener('click', () => window.__requesterShellRecoveryRun?.(true));
  }
}

export function bootstrapRequesterShellRecoveryV1(client) {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html' || started) return;
  started = true;
  const taskId = String(new URLSearchParams(location.search).get('id') || '').trim();
  if (!taskId) return renderFailure('缺少需求单号');

  let running = false;
  let rendered = false;
  const run = async (force = false) => {
    if (running) return;
    if (rendered && !force) return;
    running = true;
    try {
      const { data, error } = await client.from('test_tasks').select('*').eq('id', taskId).single();
      if (error || !data) throw error || new Error('TASK_NOT_FOUND');
      renderTask(data);
      rendered = true;
      window.__requesterShellRecovered = true;
      bootstrapRequesterDemoViewV12(client);
    } catch (error) {
      console.error('需求方壳层恢复失败', error);
      renderFailure(error?.message || String(error));
    } finally {
      running = false;
    }
  };

  window.__requesterShellRecoveryRun = run;
  const start = () => {
    run(true);
    retryTimer = setTimeout(() => {
      const title = String(document.getElementById('req-title-display')?.textContent || '');
      if (/同步需求数据|读取中|读取失败/.test(title)) run(true);
    }, 3500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('beforeunload', () => clearTimeout(retryTimer), { once: true });
}
