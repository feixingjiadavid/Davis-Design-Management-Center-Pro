import { shouldPollAiRequirement } from './requester-ai-refresh-guard-core.mjs?v=requester-ai-stability-v1';

let refreshTimer = null;
let takeoverTimer = null;
let observer = null;

function hideLegacyAiArtifacts() {
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;

  content.querySelectorAll('button[onclick*="confirmAiDemo"], [data-v8-confirm-demo], [data-requester-confirm-demo], [data-confirm-initial-draft]')
    .forEach((node) => node.remove());

  [...content.querySelectorAll('p')]
    .filter((node) => String(node.textContent || '').trim() === 'Demo 版本')
    .forEach((node) => {
      const block = node.parentElement;
      if (block) block.style.display = 'none';
    });
}

function safeScheduleAiRefresh() {
  clearTimeout(refreshTimer);

  const analysisStatus = String(window.currentAiRequirementState?.analysis?.status || '');
  if (!shouldPollAiRequirement({ analysisStatus })) return;

  refreshTimer = setTimeout(async () => {
    try {
      if (typeof window.renderAiRequirementPanel === 'function') {
        await window.renderAiRequirementPanel();
        hideLegacyAiArtifacts();
      }
    } catch (error) {
      console.error('AI 局部刷新失败:', error);
    }
  }, 2000);
}

function installSchedulerGuard() {
  if (window.scheduleAiChatRefresh !== safeScheduleAiRefresh) {
    window.scheduleAiChatRefresh = safeScheduleAiRefresh;
  }
  hideLegacyAiArtifacts();
}

export function bootstrapRequesterAiStabilityV1() {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  if (window.__requesterAiStabilityV1) return;
  window.__requesterAiStabilityV1 = true;

  installSchedulerGuard();

  // 兼容旧脚本稍后才声明 scheduleAiChatRefresh 的加载顺序：短时间内持续接管一次。
  takeoverTimer = setInterval(installSchedulerGuard, 100);
  setTimeout(() => {
    clearInterval(takeoverTimer);
    installSchedulerGuard();
  }, 10000);

  const startObserver = () => {
    const content = document.getElementById('ai-requirement-content');
    if (!content || observer) return;
    observer = new MutationObserver(() => hideLegacyAiArtifacts());
    observer.observe(content, { childList: true, subtree: true });
    hideLegacyAiArtifacts();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.addEventListener('beforeunload', () => {
    clearTimeout(refreshTimer);
    clearInterval(takeoverTimer);
    observer?.disconnect();
  }, { once: true });
}
