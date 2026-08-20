(function () {
  if (window.__requesterInitGuardV2) return;
  window.__requesterInitGuardV2 = true;

  const originalInit = window.initApp;
  if (typeof originalInit !== 'function') return;

  let started = false;
  let forced = false;

  function isStuck() {
    const text = [
      document.getElementById('req-id')?.textContent,
      document.getElementById('req-title-display')?.textContent,
      document.getElementById('header-identity-tag')?.textContent,
      document.getElementById('smart-action-panel')?.textContent,
    ].join(' ');
    return /读取中|同步需求数据|识别身份|面板初始化/.test(text);
  }

  function showBootFailure(message) {
    const title = document.getElementById('req-title-display');
    const identity = document.getElementById('header-identity-tag');
    const panel = document.getElementById('smart-action-panel');
    if (title) title.textContent = '需求页面连接失败';
    if (identity) {
      identity.textContent = '连接异常';
      identity.className = 'text-rose-300 font-bold text-[13px] bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20';
    }
    if (panel) {
      panel.innerHTML = `<div class="text-center py-5"><p class="text-rose-300 font-bold mb-2">页面初始化失败</p><p class="text-xs text-zinc-500 mb-4">${String(message || '连接组件未完成加载').replace(/[&<>"']/g, '')}</p><button id="requester-force-reload" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">重新加载</button></div>`;
      panel.querySelector('#requester-force-reload')?.addEventListener('click', () => location.reload());
    }
  }

  window.initApp = function guardedRequesterInit() {
    if (started) return;
    started = true;
    try {
      return originalInit.apply(this, arguments);
    } catch (error) {
      started = false;
      console.error('需求方页面启动失败', error);
      showBootFailure(error?.message || String(error));
    }
  };

  window.__forceRequesterInit = function forceRequesterInit() {
    started = false;
    forced = true;
    return window.initApp();
  };

  setTimeout(() => {
    if (!isStuck()) return;
    if (window.supabase && !forced) {
      window.__forceRequesterInit();
      setTimeout(() => {
        if (isStuck()) showBootFailure('数据连接已建立，但需求详情仍未完成加载。请重新加载页面。');
      }, 8000);
      return;
    }
    if (!window.supabase) showBootFailure('Supabase 连接组件未加载完成。');
  }, 12000);
})();
