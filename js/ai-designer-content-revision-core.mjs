export function latestRequesterRevisionFeedback(history = []) {
  const accepted = new Set(['requester_revision_feedback', 'reject_draft']);
  for (let index = (history || []).length - 1; index >= 0; index -= 1) {
    const item = history[index] || {};
    if (!accepted.has(String(item.action || ''))) continue;
    const feedback = String(item.reply || item.requester_feedback || '').trim();
    if (!feedback) continue;
    return {
      feedback,
      refresh_tencent_doc: Boolean(item.refresh_tencent_doc),
      action: String(item.action || ''),
      time: String(item.time || item.created_at || ''),
    };
  }
  return null;
}

export function selectAiDesignerRevisionMode({ template = null, revision = null, task = {}, history = [] } = {}) {
  if (!template) return { kind: 'initial_framework', feedback: null };
  const feedback = latestRequesterRevisionFeedback(history);
  if (revision?.status === 'content_ready') return { kind: 'ready_to_generate', feedback, revision };
  if (revision?.status === 'generation_requested' || revision?.status === 'generating') return { kind: 'generating', feedback, revision };
  if (revision?.status === 'ready_for_review') return { kind: 'requester_review', feedback, revision };
  if (revision?.status === 'capacity_conflict') return { kind: 'capacity_conflict', feedback, revision };
  if (revision?.status === 'failed') return { kind: 'failed', feedback, revision };
  if (feedback && ['rejected', 'reviewing', 'needs_input', 'processing'].includes(String(task.status || ''))) {
    return { kind: 'needs_analysis', feedback, revision: null };
  }
  return { kind: 'template_locked_idle', feedback, revision };
}
