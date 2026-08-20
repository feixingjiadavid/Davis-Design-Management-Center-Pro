const formalActions = new Set(['submit_framework','reject_framework','framework_adjustment_submitted','approve_framework','content_revision_submitted','submit_draft','complete']);

export function latestFormalAction(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (formalActions.has(String(history[index]?.action || ''))) return history[index];
  }
  return null;
}

function latestRequesterFeedback(history = []) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const action = String(history[index]?.action || '');
    if (!['requester_revision_feedback', 'reject_draft'].includes(action)) continue;
    const feedback = String(history[index]?.reply || history[index]?.requester_feedback || '').trim();
    if (feedback) return history[index];
  }
  return null;
}

export function buildRequesterRevisionRequest(feedback = '', refreshTencentDoc = false) {
  const requester_feedback = String(feedback || '').trim();
  if (!requester_feedback) throw new Error('REQUESTER_REVISION_FEEDBACK_REQUIRED');
  return { requester_feedback, refresh_tencent_doc: Boolean(refreshTencentDoc) };
}

export function selectRequesterFlowState({ task = {}, template = null, revisions = [], history = [] } = {}) {
  const status = String(task.status || '');
  const latest = [...(revisions || [])].sort((a, b) => Number(b.revision_no || 0) - Number(a.revision_no || 0))[0] || null;
  const formal = latestFormalAction(history || []);
  const requesterFeedback = latestRequesterFeedback(history || []);
  if (status === 'completed' || status === 'archived') return { kind: 'completed', latest, formal };
  if (status === 'rejected' && !template) return { kind: 'framework_rejected_waiting_requester', latest, formal };
  if (!template) return { kind: 'pre_template', latest, formal };
  if (latest?.status === 'capacity_conflict') return { kind: 'capacity_conflict', latest, formal };
  if (latest?.status === 'generating' || latest?.status === 'generation_requested') return { kind: 'content_revision_generating', latest, formal };
  if (latest?.status === 'content_ready') return { kind: 'content_revision_waiting_ai', latest, formal };
  if (latest?.status === 'ready_for_review') return { kind: 'content_revision_review', latest, formal };
  if (!latest && requesterFeedback) return { kind: 'content_revision_requested', latest, formal };
  if (status === 'rejected') return { kind: 'content_revision_requested', latest, formal };
  if (status === 'reviewing') return { kind: 'template_review', latest, formal };
  return { kind: 'template_active', latest, formal };
}

export function isRequesterUser(user = {}) {
  const enName = String(user.enName || user.email || '').toLowerCase();
  const accountType = String(user.account_type || '').toLowerCase();
  return accountType === 'uat_requester' || enName === 'uat.requester' || enName === 'uat.requester@webank.com';
}

export function isLeaderUser(user = {}) {
  const enName = String(user.enName || user.email || '').toLowerCase();
  const accountType = String(user.account_type || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  return enName === 'judyzzhang' || enName === 'uat.leader' || enName === 'uat.leader@webank.com' || accountType === 'uat_leader' || role === 'leader';
}
