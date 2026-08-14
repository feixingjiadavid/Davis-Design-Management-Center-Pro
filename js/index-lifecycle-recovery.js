const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isIndexPage(pathname = globalThis.location?.pathname || '') {
  return /\/(?:index\.html)?$/.test(String(pathname));
}

export function identityStillLoading(documentObject = globalThis.document) {
  const button = documentObject?.getElementById?.('identityBtn');
  return Boolean(button && /加载中/.test(String(button.textContent || '')));
}

function bindOnce(element, key, eventName, handler) {
  if (!element || element.dataset?.[key] === '1') return;
  if (element.dataset) element.dataset[key] = '1';
  element.addEventListener(eventName, handler);
}

function bindRecoveredInteractions() {
  const idBtn = document.getElementById('identityBtn');
  const idMenu = document.getElementById('identityMenu');
  bindOnce(idBtn, 'recoveryBound', 'click', (event) => {
    event.stopPropagation();
    idMenu?.classList.toggle('hidden');
  });

  const notifBtn = document.getElementById('notifBtn');
  const notifMenu = document.getElementById('notifMenu');
  bindOnce(notifBtn, 'recoveryBound', 'click', (event) => {
    event.stopPropagation();
    notifMenu?.classList.toggle('hidden');
  });

  if (!window.__davisIndexDocumentRecoveryBound) {
    window.__davisIndexDocumentRecoveryBound = true;
    document.addEventListener('click', (event) => {
      if (idMenu && !idMenu.contains(event.target)) idMenu.classList.add('hidden');
      if (notifMenu && !notifMenu.contains(event.target)) notifMenu.classList.add('hidden');
      const projectWrapper = document.getElementById('project-wrapper');
      const projectDropdown = document.getElementById('project-dropdown');
      if (projectWrapper && projectDropdown && !projectWrapper.contains(event.target)) projectDropdown.classList.add('hidden');
      const assigneeWrapper = document.getElementById('assignee-wrapper');
      const assigneeDropdown = document.getElementById('assignee-dropdown');
      if (assigneeWrapper && assigneeDropdown && !assigneeWrapper.contains(event.target)) assigneeDropdown.classList.add('hidden');
    });
  }
}

export async function recoverIndexLifecycle() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !isIndexPage()) return false;

  if (document.readyState === 'loading') {
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  // Give the page's native DOMContentLoaded handler a brief chance to run first.
  await sleep(120);
  if (!identityStillLoading()) return false;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (typeof window.initRBAC === 'function' && typeof window.loadTasksFromCloud === 'function') break;
    await sleep(50);
  }
  if (typeof window.initRBAC !== 'function' || typeof window.loadTasksFromCloud !== 'function') {
    console.error('需求大厅恢复启动失败：index.js 主模块未完成加载');
    return false;
  }

  if (window.__davisIndexLifecycleRecovered) return false;
  window.__davisIndexLifecycleRecovered = true;

  const user = window.initRBAC();
  if (!user) return false;

  try { await window.loadAssigneesFromCloud?.(); } catch (error) { console.error('执行人列表恢复加载失败:', error); }
  bindRecoveredInteractions();
  await window.loadTasksFromCloud();

  if (!window.__davisIndexRecoverySyncTimer) {
    window.__davisIndexRecoverySyncTimer = setInterval(() => window.loadTasksFromCloud(true), 8000);
  }
  console.warn('需求大厅已通过生命周期恢复器完成启动');
  return true;
}

recoverIndexLifecycle().catch((error) => console.error('需求大厅生命周期恢复失败:', error));
