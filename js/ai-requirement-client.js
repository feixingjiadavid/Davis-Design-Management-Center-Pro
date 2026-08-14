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

export function getRequesterWorkflowState(status) {
  if (status === 'completed' || status === 'archived') return { kind: 'completed' };
  if (status === 'terminated') return { kind: 'terminated' };
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
  const [sourcesResult, analysesResult, clarificationsResult, generationsResult] = await Promise.all([
    supabase.from('uat_requirement_sources').select('*,uat_source_snapshots!uat_source_snapshots_source_id_fkey(*)').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_requirement_analyses').select('*').eq('task_id', taskId).order('version', { ascending: false }).limit(1),
    supabase.from('uat_clarifications').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_design_generations').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
  ]);
  const error = sourcesResult.error || analysesResult.error || clarificationsResult.error || generationsResult.error;
  if (error) throw error;
  const analysis = selectCurrentAnalysis(analysesResult.data || []);
  return {
    sources: selectActiveSources(sourcesResult.data || [], activeSourceUrl),
    analysis,
    clarifications: selectCurrentClarifications(clarificationsResult.data || [], analysis),
    generations: generationsResult.data || [],
  };
}

export async function invokeAiAction(supabase, taskId, action, payload = {}) {
  const body = { task_id: taskId, action, ...payload };
  if (action === 'generate_demo' || action === 'generate_final') {
    body.idempotency_key = payload.idempotency_key || newIdempotencyKey();
  }
  const { data, error } = await supabase.functions.invoke('uat-ai-design', { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'AI 流程执行失败');
  return data;
}

export async function startAutomaticAnalysis(supabase, taskId) {
  return await invokeAiAction(supabase, taskId, 'auto_analyze');
}
