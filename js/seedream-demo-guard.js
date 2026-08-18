import { shouldContinuePolling, healthResult } from './seedream-demo-guard-core.js';

const HEALTH_URL = 'https://bjzfkwxrvytgphvgwltl.supabase.co/functions/v1/uat-ark-gateway';
const POLL_MS = 1500;
let pollTimer = null;
let inflightTaskId = '';
let inflightStartedAt = 0;
let bypassButton = null;

function activeTaskId() {
  return String(document.querySelector('.task.active')?.dataset?.id || '').trim();
}

function detailText() {
  return String(document.getElementById('detail')?.innerText || '');
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  inflightTaskId = '';
  inflightStartedAt = 0;
}

function ensureConnectivityMessage(button) {
  const parent = button?.parentElement;
  if (!parent) return null;
  let node = parent.querySelector('[data-seedream-connectivity]');
  if (!node) {
    node = document.createElement('p');
    node.dataset.seedreamConnectivity = '1';
    node.className = 'text-[11px] mt-3';
    parent.appendChild(node);
  }
  return node;
}

function renderConnectivity(button, state, detail = '') {
  const node = ensureConnectivityMessage(button);
  if (!node) return;
  if (state === 'checking') {
    node.className = 'text-[11px] mt-3 text-amber-300';
    node.textContent = '正在检查 UAT Ark Gateway → 火山方舟连通性（不产生生图费用）…';
  } else if (state === 'ok') {
    node.className = 'text-[11px] mt-3 text-emerald-300';
    node.textContent = `UAT Ark Gateway 连通正常${detail ? ` · ${detail}` : ''}`;
  } else {
    node.className = 'text-[11px] mt-3 text-rose-300';
    node.textContent = `UAT Ark Gateway 当前不可用${detail ? `：${detail}` : ''}。未发起 Seedream 生图，不会产生本次图像用量。`;
  }
}

async function checkHealth(supabase, button) {
  renderConnectivity(button, 'checking');
  const { data: { session } } = await supabase.auth.getSession();
  const token = String(session?.access_token || '');
  if (!token) return { ok: false, error: 'UAT_SESSION_MISSING' };
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'health' }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => ({}));
    return healthResult(payload);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function tickPolling() {
  if (!inflightTaskId) return stopPolling();
  const text = detailText();
  const elapsed = Date.now() - inflightStartedAt;
  if (elapsed > 7 * 60 * 1000 || !shouldContinuePolling({ inflight: true, text })) {
    if (/生成失败|已完成|待需求方确认/.test(text) || (elapsed > 4000 && /Demo 已就绪/.test(text))) stopPolling();
  }
  if (!inflightTaskId) return;
  document.getElementById('refresh')?.click();
}

function startPolling(taskId) {
  inflightTaskId = taskId;
  inflightStartedAt = Date.now();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(tickPolling, POLL_MS);
  setTimeout(() => document.getElementById('refresh')?.click(), 350);
}

function protectInflightButton() {
  if (!inflightTaskId) return;
  const button = document.getElementById('demoStartBtn');
  const text = detailText();
  if (button && activeTaskId() === inflightTaskId && !/生成失败|已完成/.test(text)) {
    button.disabled = true;
    button.textContent = '请求处理中，正在读取真实状态…';
  }
}

export function bootstrapSeedreamDemoGuard(supabase) {
  const path = location.pathname.split('/').pop() || '';
  if (path !== 'ai-designer-workspace.html' || window.__seedreamDemoGuardStarted) return;
  window.__seedreamDemoGuardStarted = true;

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('#demoStartBtn');
    if (!button) return;
    if (bypassButton === button) {
      bypassButton = null;
      startPolling(activeTaskId());
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = '检查 UAT Ark Gateway…';
    const health = await checkHealth(supabase, button);
    if (!health.ok) {
      renderConnectivity(button, 'failed', health.error);
      button.disabled = false;
      button.textContent = original || '开始生成 Seedream 4.0 Demo';
      return;
    }
    renderConnectivity(button, 'ok', health.status ? `HTTP ${health.status}` : '网络可达');
    button.disabled = false;
    button.textContent = '连通成功，正在发起…';
    bypassButton = button;
    button.click();
  }, true);

  const observer = new MutationObserver(() => protectInflightButton());
  observer.observe(document.body, { childList: true, subtree: true });
}
