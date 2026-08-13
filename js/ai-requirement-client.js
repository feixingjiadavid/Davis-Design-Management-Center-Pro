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

export async function loadAiRequirementState(supabase, taskId) {
  const [sourcesResult, analysesResult, clarificationsResult, generationsResult] = await Promise.all([
    supabase.from('uat_requirement_sources').select('*,uat_source_snapshots(*)').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_requirement_analyses').select('*').eq('task_id', taskId).order('version', { ascending: false }).limit(1),
    supabase.from('uat_clarifications').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('uat_design_generations').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
  ]);
  const error = sourcesResult.error || analysesResult.error || clarificationsResult.error || generationsResult.error;
  if (error) throw error;
  return {
    sources: sourcesResult.data || [],
    analysis: analysesResult.data?.[0] || null,
    clarifications: clarificationsResult.data || [],
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
