import { shouldPollAiRequirement } from './requester-ai-refresh-guard-core.mjs?v=requester-ai-stability-v1';

let refreshTimer = null;
let takeoverTimer = null;
let observer = null;

function requesterGenerationForbidden() {
  if (typeof window.showToast === 'function') {
    window.showToast('无生图权限', '需求方只能补充需求信息；图片生成由 AI 设计师执行。', 'info');
  }
  return false;
}

function hideLegacyAiArtifacts() {
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;

  content.querySelectorAll([
    'button[onclick*="confirmAiUnderstanding"]',
    'button[onclick*="confirmAiDemo"]',
    '[data-v8-confirm-demo]',
    '[data-requester-confirm-demo]',
    '[data-confirm-initial-draft]',
    '[data-generate-demo]',
    '[data-generate-final]'
  ].join(','))
    .forEach((node) => node.remove());

  [...content.querySelectorAll('p')]
    .filter((node) => ['Demo 版本', 'Seedream 4.0 成品'].includes(String(node.textContent || '').trim()))
    .forEach((node) => {
      const block = node.parentElement;
      if (block) block.style.display = 'none';
    });
}

function installRequesterGenerationGuards() {
  window.confirmAiUnderstanding = requesterGenerationForbidden;
  window.confirmAiDemo = requesterGenerationForbidden;
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
        installRequesterGenerationGuards();
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
  installRequesterGenerationGuards();
  hideLegacyAiArtifacts();
}

export function bootstrapRequesterAiStabilityV1() {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  if (window.__requesterAiStabilityV1) return;
  window.__requesterAiStabilityV1 = true;

  installSchedulerGuard();

  // 兼容旧脚本稍后声明生成函数：持续接管，确保需求方永远拿不到生图入口。
  takeoverTimer = setInterval(installSchedulerGuard, 100);
  setTimeout(() => {
    clearInterval(takeoverTimer);
    installSchedulerGuard();
  }, 15000);

  const startObserver = () => {
    const content = document.getElementById('ai-requirement-content');
    if (!content || observer) return;
    observer = new MutationObserver(() => {
      hideLegacyAiArtifacts();
      installRequesterGenerationGuards();
    });
    observer.observe(content, { childList: true, subtree: true });
    hideLegacyAiArtifacts();
    installRequesterGenerationGuards();
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
