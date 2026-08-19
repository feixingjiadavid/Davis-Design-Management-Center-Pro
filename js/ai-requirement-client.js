export const SOURCE_STATUS_COPY = {
  pending: '等待读取',
  reading: '正在读取',
  ready: '读取成功',
  authorization_required: '需要微信/QQ官方授权，或将当前文档设为获得链接的人可查看',
  permission_denied: '当前账号无权读取',
  unsupported: '暂不支持，请上传 Word/PDF',
  failed: '读取失败，可手动重试',
};

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

export function edgeFunctionForAction(_action) {
  return 'uat-ai-design';
}

export function getRequesterWorkflowState(status) {
  if (status === 'completed' || status === 'archived') return { kind: 'completed' };
  if (status === 'terminated') return { kind: 'terminated' };
  if (status === 'waiting_visual_reference') return { kind: 'waiting_visual_reference' };
  if (status === 'needs_input') return { kind: 'needs_input' };
  if (status === 'understanding_ready') return { kind: 'understanding_ready' };
  if (status === 'analysis_failed') return { kind: 'analysis_failed' };
  return { kind: 'active' };
}

export function selectActiveSources(sources, activeSourceUrl) {
  const currentUrl = String(activeSourceUrl || '').trim();
  return sources.filter(source => source.source_type !== 'tencent_doc' || (currentUrl && source.source_url === currentUrl));
}

export function selectCurrentAnalysis(analyses) {
  const latest = analyses?.[0] || null;
  return latest?.status === 'stale' ? null : latest;
}

export function selectCurrentClarifications(clarifications, analysis) {
  if (!analysis?.id) return [];
  return clarifications.filter(item => item.analysis_id === analysis.id);
}

export async function loadAiRequirementState(supabase, taskId, activeSourceUrl = '') {
  const [sourcesResult, analysesResult, clarificationsResult, generationsResult, messagesResult, referencesResult] = await Promise.all([
    supabase.from('uat_requirement_sources').select('*,uat_source_snapshots!uat_source_snapshots_source_id_fkey(*)').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_requirement_analyses').select('*').eq('task_id', taskId).order('version', { ascending: false }).limit(1),
    supabase.from('uat_clarifications').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_design_generations').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_clarification_messages').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_visual_references').select('*').eq('task_id', taskId).order('sort_order', { ascending: true }),
  ]);
  const error = sourcesResult.error || analysesResult.error || clarificationsResult.error || generationsResult.error || messagesResult.error || referencesResult.error;
  if (error) throw error;
  const analysis = selectCurrentAnalysis(analysesResult.data || []);
  return {
    sources: selectActiveSources(sourcesResult.data || [], activeSourceUrl),
    analysis,
    clarifications: selectCurrentClarifications(clarificationsResult.data || [], analysis),
    generations: generationsResult.data || [],
    messages: messagesResult.data || [],
    visualReferences: referencesResult.data || [],
  };
}

export async function saveVisualReferences(supabase, taskId, references, { replace = false } = {}) {
  if (!Array.isArray(references) || references.length < 1 || references.length > 6) throw new Error('视觉参考图需为1-6张');
  if (replace) {
    const { error: deleteError } = await supabase.from('uat_visual_references').delete().eq('task_id', taskId);
    if (deleteError) throw deleteError;
  }
  const rows = references.map((reference, index) => ({
    task_id: taskId,
    file_name: reference.file_name || `reference-${index + 1}.jpg`,
    data_url: reference.data_url,
    note: String(reference.note || ''),
    is_primary: Boolean(reference.is_primary),
    sort_order: Number.isInteger(reference.sort_order) ? reference.sort_order : index,
  }));
  if (!rows.some(row => row.is_primary) && replace) rows[0].is_primary = true;
  if (rows.filter(row => row.is_primary).length > 1) {
    const primaryIndex = rows.findIndex(item => item.is_primary);
    rows.forEach((row, index) => { row.is_primary = index === primaryIndex; });
  }
  if (rows.some(row => row.is_primary)) {
    const { error: clearError } = await supabase.from('uat_visual_references').update({ is_primary: false, updated_at: new Date().toISOString() }).eq('task_id', taskId).eq('is_primary', true);
    if (clearError) throw clearError;
  }
  const { data, error } = await supabase.from('uat_visual_references').insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

export async function deleteVisualReference(supabase, taskId, referenceId) {
  const { error } = await supabase.from('uat_visual_references').delete().eq('task_id', taskId).eq('id', referenceId);
  if (error) throw error;
}

export async function setPrimaryVisualReference(supabase, taskId, referenceId) {
  const { error: clearError } = await supabase.from('uat_visual_references').update({ is_primary: false, updated_at: new Date().toISOString() }).eq('task_id', taskId).eq('is_primary', true);
  if (clearError) throw clearError;
  const { error } = await supabase.from('uat_visual_references').update({ is_primary: true, updated_at: new Date().toISOString() }).eq('task_id', taskId).eq('id', referenceId);
  if (error) throw error;
}

export async function submitClarificationAnswers(supabase, taskId, answers, message = '', clientRequestId = crypto.randomUUID()) {
  return await invokeAiAction(supabase, taskId, 'answer_clarifications', { answers, message, client_request_id: clientRequestId });
}

export async function delegateClarificationsToAi(supabase, taskId, clientRequestId = crypto.randomUUID()) {
  return await invokeAiAction(supabase, taskId, 'delegate_to_ai', { client_request_id: clientRequestId });
}

export async function invokeAiAction(supabase, taskId, action, payload = {}) {
  const body = { task_id: taskId, action, ...payload };
  const { data, error } = await supabase.functions.invoke(edgeFunctionForAction(action), { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'AI 流程执行失败');
  return data;
}

export const approveFramework = (supabase, taskId, note = '') => invokeAiAction(supabase, taskId, 'approve_framework', { note });
export const rejectFramework = (supabase, taskId, reason = '') => invokeAiAction(supabase, taskId, 'reject_framework', { reason });
export const generateFrameworkRevision = (supabase, taskId, payload = {}) => invokeAiAction(supabase, taskId, 'generate_framework_revision', {
  ...payload,
  idempotency_key: payload.idempotency_key || newIdempotencyKey(),
});
export const checkContentUpdate = (supabase, taskId) => invokeAiAction(supabase, taskId, 'check_content_update');
export const prepareContentRevision = (supabase, taskId, payload = {}) => invokeAiAction(supabase, taskId, 'prepare_content_revision', payload);
export const generateContentRevision = (supabase, taskId, revisionId) => invokeAiAction(supabase, taskId, 'generate_content_revision', {
  revision_id: revisionId,
  idempotency_key: newIdempotencyKey(),
});
export const submitContentRevisionRequest = (supabase, taskId, payload = {}) => invokeAiAction(supabase, taskId, 'submit_content_revision_request', {
  ...payload,
  idempotency_key: payload.idempotency_key || newIdempotencyKey(),
});
export const acceptCurrentRevision = (supabase, taskId) => invokeAiAction(supabase, taskId, 'accept_current_revision');

export async function startAutomaticAnalysis(supabase, taskId) {
  return await invokeAiAction(supabase, taskId, 'auto_analyze');
}
