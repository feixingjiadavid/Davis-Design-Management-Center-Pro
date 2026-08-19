export function shouldRenderDashboard(previousSnapshot, nextSnapshot, isSilent = false) {
  return !isSilent || String(previousSnapshot ?? '') !== String(nextSnapshot ?? '');
}

export function hasApprovedFramework(history = []) {
  return Array.isArray(history) && history.some((item) => String(item?.action || '') === 'approve_framework' && item?.is_rejected !== true);
}

export function resolveAiPipelineStage({ status = '', hasDemo = false, hasFinal = false, history = [] } = {}) {
  const s = String(status || '');
  if (['completed', 'archived', 'reviewing', 'final_review'].includes(s) || hasFinal) return 5;
  if (s === 'pending_approval') return 3;
  if (s === 'processing' && hasDemo && hasApprovedFramework(history)) return 4;
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
