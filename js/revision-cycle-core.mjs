export function parseHistory(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const value = JSON.parse(String(raw || '[]'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function latestRequesterFeedback(history = []) {
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
      revision_id: String(item.revision_id || ''),
    };
  }
  return null;
}

export function feedbackCoveredByRevision(feedback, revision) {
  if (!feedback || !revision) return false;
  if (feedback.revision_id && feedback.revision_id === String(revision.id || '')) return true;
  const revisionFeedback = String(revision.system_content || revision.change_summary?.requester_feedback || '').trim();
  if (revisionFeedback && revisionFeedback === String(feedback.feedback || '').trim()) return true;
  const feedbackTime = Date.parse(String(feedback.time || ''));
  const revisionTime = Date.parse(String(revision.submitted_at || revision.created_at || ''));
  return Number.isFinite(feedbackTime) && Number.isFinite(revisionTime) && revisionTime >= feedbackTime;
}

export function nextRevisionNo(revisions = []) {
  return Math.max(0, ...(revisions || []).map((item) => Number(item?.revision_no || 0))) + 1;
}

export function revisionStage(status = '') {
  const value = String(status || '');
  if (value === 'content_ready') return { key:'understood', label:'AI 已理解，准备生成' };
  if (value === 'generation_requested' || value === 'generating') return { key:'generating', label:'AI 正在生成修改页' };
  if (value === 'ready_for_review') return { key:'review', label:'已交付，等待需求方验收' };
  if (value === 'accepted') return { key:'accepted', label:'需求方已验收' };
  if (value === 'superseded') return { key:'superseded', label:'已交付，后续继续修改' };
  if (value === 'capacity_conflict') return { key:'blocked', label:'内容容量冲突' };
  if (value === 'failed') return { key:'failed', label:'本轮生成失败' };
  return { key:'pending', label:value || '等待处理' };
}

export function activeRevision(revisions = []) {
  return [...(revisions || [])].sort((a, b) => Number(b?.revision_no || 0) - Number(a?.revision_no || 0))[0] || null;
}
