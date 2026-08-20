import { shouldPollAiRequirement } from './requester-ai-refresh-guard-core.mjs?v=requester-ai-stability-v1';

let refreshTimer = null;
let observer = null;
let observerTimer = null;

function requesterGenerationForbidden() {
  if (typeof window.showToast === 'function') window.showToast('无生图权限', '需求方只能补充需求信息；图片生成由 AI 设计师执行。', 'info');
  return false;
}

function revisionLoopOwnsClarifications() { return Boolean(document.querySelector('[data-revision-loop-root="v1"]')); }
function directChildOf(node, parent) { let current = node; while (current?.parentElement && current.parentElement !== parent) current = current.parentElement; return current?.parentElement === parent ? current : null; }

function syncLegacyClarificationOwnership() {
  const content = document.getElementById('ai-requirement-content');
  const section = content?.querySelector('#ai-clarification-chat');
  if (!section) return;
  const ownedByRevisionLoop = revisionLoopOwnsClarifications();
  const questionInputs = [...section.querySelectorAll('[data-ai-question]')];
  const questionContainers = new Set(questionInputs.map((input) => directChildOf(input, section)).filter(Boolean));
  const generalMessage = section.querySelector('#ai-general-message');
  const submitButton = section.querySelector('#ai-chat-submit');
  const delegateButton = section.querySelector('button[onclick*="delegateAiClarifications"]');
  const actionRow = submitButton ? directChildOf(submitButton, section) : null;
  questionContainers.forEach((node) => { node.style.display = ownedByRevisionLoop ? 'none' : ''; });
  if (generalMessage) generalMessage.style.display = ownedByRevisionLoop ? 'none' : '';
  if (actionRow) actionRow.style.display = ownedByRevisionLoop ? 'none' : '';
  else { if (submitButton) submitButton.style.display = ownedByRevisionLoop ? 'none' : ''; if (delegateButton) delegateButton.style.display = ownedByRevisionLoop ? 'none' : ''; }
  const headerStatus = section.firstElementChild?.querySelector('span');
  let notice = section.querySelector('[data-revision-chat-readonly]');
  if (ownedByRevisionLoop) {
    if (headerStatus) headerStatus.textContent = '本轮沟通记录';
    if (!notice) { notice = document.createElement('div'); notice.dataset.revisionChatReadonly = '1'; notice.className = 'mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-300'; notice.textContent = '本轮修改问题请在上方修改循环中回答；这里仅保留需求方与 AI 设计师的沟通记录。'; section.appendChild(notice); }
  } else if (notice) notice.remove();
}

function hideLegacyAiArtifacts() {
  const content = document.getElementById('ai-requirement-content');
  if (!content) return;
  content.querySelectorAll('button[onclick*="confirmAiUnderstanding"],button[onclick*="confirmAiDemo"],[data-v8-confirm-demo],[data-requester-confirm-demo],[data-confirm-initial-draft],[data-generate-demo],[data-generate-final]').forEach((node) => node.remove());
  [...content.querySelectorAll('p')].filter((node) => ['Demo 版本', 'Seedream 4.0 成品'].includes(String(node.textContent || '').trim())).forEach((node) => { const block = node.parentElement; if (block) block.style.display = 'none'; });
  syncLegacyClarificationOwnership();
}

function installRequesterGenerationGuards() { window.confirmAiUnderstanding = requesterGenerationForbidden; window.confirmAiDemo = requesterGenerationForbidden; }

function safeScheduleAiRefresh() {
  clearTimeout(refreshTimer);
  const analysisStatus = String(window.currentAiRequirementState?.analysis?.status || '');
  if (!shouldPollAiRequirement({ analysisStatus })) return;
  refreshTimer = setTimeout(async () => {
    if (document.hidden) return safeScheduleAiRefresh();
    try {
      if (typeof window.renderAiRequirementPanel === 'function') {
        await window.renderAiRequirementPanel();
        hideLegacyAiArtifacts();
        installRequesterGenerationGuards();
      }
    } catch (error) { console.error('AI 局部刷新失败:', error); }
  }, 5000);
}

function installSchedulerGuard() {
  if (window.scheduleAiChatRefresh !== safeScheduleAiRefresh) window.scheduleAiChatRefresh = safeScheduleAiRefresh;
  installRequesterGenerationGuards();
  hideLegacyAiArtifacts();
}

export function bootstrapRequesterAiStabilityV1() {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html' || window.__requesterAiStabilityV1) return;
  window.__requesterAiStabilityV1 = true;
  installSchedulerGuard();

  const startObserver = () => {
    const content = document.getElementById('ai-requirement-content');
    if (!content || observer) return;
    observer = new MutationObserver(() => {
      clearTimeout(observerTimer);
      observerTimer = setTimeout(() => { if (!document.hidden) installSchedulerGuard(); }, 180);
    });
    observer.observe(content, { childList: true, subtree: true });
    installSchedulerGuard();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true }); else startObserver();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) installSchedulerGuard(); });
  window.addEventListener('beforeunload', () => { clearTimeout(refreshTimer); clearTimeout(observerTimer); observer?.disconnect(); }, { once: true });
}
