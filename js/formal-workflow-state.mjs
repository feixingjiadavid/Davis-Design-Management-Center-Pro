export function shouldRenderDashboard(previousSnapshot, nextSnapshot, isSilent = false) {
  return !isSilent || String(previousSnapshot ?? '') !== String(nextSnapshot ?? '');
}

export function hasApprovedFramework(history = []) {
  return Array.isArray(history) && history.some((item) => String(item?.action || '') === 'approve_framework' && item?.is_rejected !== true);
}

export function resolveAiPipelineStage({ status = '', hasDemo = false, hasFinal = false, history = [] } = {}) {
  const s = String(status || '');
  const frameworkApproved = hasApprovedFramework(history);
  if (['completed', 'archived', 'reviewing', 'final_review'].includes(s) || hasFinal) return 5;
  if (s === 'pending_approval') return 3;

  // Once the leader approved the framework, stages 1-4 are historical facts and must never regress.
  // Content revisions may cycle through understanding/clarification/generation, but the original
  // read → understand → demo → leader approval progress stays completed forever.
  if (frameworkApproved && hasDemo && ['processing','needs_input','understanding_ready','ready_for_demo','ready_for_final'].includes(s)) return 4;

  if (s === 'processing' && hasDemo && frameworkApproved) return 4;
  if (s === 'ready_for_final' && hasDemo) return 4;
  if (hasDemo || ['generating_demo', 'demo_review', 'demo_failed'].includes(s)) return 2;
  if (['processing', 'needs_input', 'understanding_ready', 'ready_for_demo'].includes(s)) return 1;
  return 0;
}

export function isFormalLeader(user = {}) {
  const enName = String(user?.enName || '').toLowerCase();
  const accountType = String(user?.account_type || '').toLowerCase();
  const role = String(user?.role || '').toLowerCase();
  return enName === 'judyzzhang' || enName === 'uat.leader' || accountType === 'uat_leader' || role === 'leader';
}
