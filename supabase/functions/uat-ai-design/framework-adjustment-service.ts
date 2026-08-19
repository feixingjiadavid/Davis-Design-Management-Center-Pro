import { latestFormalAction, latestSubmittedFramework } from './framework-template-core.ts';

export const FRAMEWORK_DEMO_MODEL = 'doubao-seedream-4-0-250828';
export const FRAMEWORK_DEMO_PROMPT_VERSION = 'seedream-demo-creative-director-v2';

function historyOf(task: any) {
  try {
    const history = JSON.parse(String(task?.history_json || '[]'));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}
function latestLeaderReject(history: any[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) if (history[index]?.action === 'reject_framework') return history[index];
  return null;
}

export async function generateFrameworkRevision(admin: any, taskId: string, actorId: string, payload: any, deps: any) {
  const direction = String(payload?.requester_direction || '').trim();
  if (!direction) throw new Error('REQUESTER_DIRECTION_REQUIRED');
  const key = String(payload?.idempotency_key || '').trim();
  if (!key) throw new Error('IDEMPOTENCY_KEY_REQUIRED');

  const taskResult = await admin.from('test_tasks').select('*').eq('id', taskId).single();
  if (taskResult.error || !taskResult.data) throw new Error('TASK_NOT_FOUND');
  const task = taskResult.data;
  const history = historyOf(task);
  const formal = latestFormalAction(history);
  if (String(task.status) !== 'rejected' || !['reject_framework','framework_adjustment_submitted'].includes(String(formal?.action || ''))) throw new Error('FRAMEWORK_NOT_WAITING_REQUESTER_DIRECTION');

  const submitted: any = latestSubmittedFramework(history);
  const leaderReject = latestLeaderReject(history);
  const leaderFeedback = String(leaderReject?.reply || '').trim();
  const adjustment = await admin.from('uat_framework_adjustments').insert({
    task_id: taskId,
    based_on_framework_version: String(submitted?.version || leaderReject?.version || ''),
    leader_feedback: leaderFeedback,
    requester_direction: direction,
    supplemental_content: String(payload?.supplemental_content || '').trim() || null,
    refresh_tencent_doc: Boolean(payload?.refresh_tencent_doc),
    created_by: actorId,
  }).select('*').single();
  if (adjustment.error) throw adjustment.error;

  if (payload?.refresh_tencent_doc && deps?.refreshSources) await deps.refreshSources(admin, task, actorId);
  const supplemental = String(payload?.supplemental_content || '').trim();
  const augmentedTask = {
    ...task,
    full_desc: [String(task.full_desc || ''), supplemental ? `本轮补充业务内容：${supplemental}` : ''].filter(Boolean).join('\n\n'),
    workflow_context: {
      mode: 'framework_revision',
      based_on_framework_version: String(submitted?.version || ''),
      leader_feedback: leaderFeedback,
      requester_direction: direction,
      supplemental_content: supplemental,
      rule: '领导驳回后的下一轮框架必须以需求方与领导沟通后的 requester_direction 为执行方向；不得由 AI 自行猜测替代。',
    },
  };
  const analysis = await deps.analyze(admin, augmentedTask, payload?.user_jwt || '');

  if (String(analysis.status) === 'clarification_required') {
    await admin.from('test_tasks').update({ status: 'needs_input', summary_desc: '框架调整资料仍有关键信息需要需求方补充' }).eq('id', taskId);
    return { status: 'needs_input', adjustment: adjustment.data, analysis, generations: [] };
  }
  if (!['understanding_ready', 'confirmed'].includes(String(analysis.status))) throw new Error('ANALYSIS_NOT_READY');
  if (String(analysis.status) === 'understanding_ready' && deps?.confirmAnalysis) await deps.confirmAnalysis(admin, taskId, analysis.id, actorId);
  await admin.from('uat_framework_adjustments').update({ consumed_by_analysis_id: analysis.id }).eq('id', adjustment.data.id);

  const pages = Array.isArray(analysis?.brief?.pages) ? analysis.brief.pages : [];
  if (!pages.length) throw new Error('DEMO_PAGE_CONTENT_REQUIRED');
  const rows = pages.map((page: any, offset: number) => ({
    task_id: taskId,
    analysis_id: analysis.id,
    kind: 'demo',
    model: FRAMEWORK_DEMO_MODEL,
    prompt_version: FRAMEWORK_DEMO_PROMPT_VERSION,
    idempotency_key: `${key}:p${Number(page.index || offset + 1)}`,
    page_index: Number(page.index || offset + 1),
    page_count: pages.length,
    status: 'queued',
    generation_mode: 'framework_revision',
    framework_adjustment_id: adjustment.data.id,
    output: { run_id: key, queued_by: 'uat.requester@webank.com' },
  }));
  const queued = await admin.from('uat_design_generations').insert(rows).select('*');
  if (queued.error) throw queued.error;

  history.push({
    action: 'framework_adjustment_submitted', adjustment_id: adjustment.data.id,
    based_on_version: String(submitted?.version || ''), leader_feedback: leaderFeedback,
    requester_direction: direction, operator: 'UAT 需求方', time: new Date().toISOString(),
  });
  await admin.from('test_tasks').update({
    status: 'processing', summary_desc: '需求方已提交新框架调整要求，AI 正在生成下一版框架', history_json: JSON.stringify(history),
  }).eq('id', taskId);
  return { status: 'processing', adjustment: adjustment.data, analysis, generations: queued.data || [] };
}
