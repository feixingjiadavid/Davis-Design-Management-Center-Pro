import { approveFramework, rejectFramework } from './framework-lifecycle-service.ts';
import { generateFrameworkRevision } from './framework-adjustment-service.ts';
import { acceptCurrentRevision, checkContentUpdate, prepareContentRevision, queueContentRevision } from './content-revision-service.ts';
import { submitRequesterRevisionRequest } from './content-revision-request.mjs';
import { ingestTaskSources } from './source-service.ts';
import { analyzeRequirement, confirmUnderstanding } from './analysis-service.ts';
import { saveAiProcessingAck, saveRequesterAnswers } from './clarification-chat.ts';
import { assertTemplateWorkflowActor } from './template-workflow-permissions.mjs';
import { buildRevisionInstruction } from './revision-clarification-context.mjs';

const LEADER = 'uat.leader@webank.com';
const AI_DESIGNER = 'davis.design.ai@webank.com';

export const TEMPLATE_WORKFLOW_ACTIONS = new Set([
  'approve_framework','reject_framework','generate_framework_revision','check_content_update',
  'prepare_content_revision','generate_content_revision','submit_content_revision_request',
  'answer_content_revision_clarification','accept_current_revision',
]);

export function isTemplateWorkflowAction(action: string) { return TEMPLATE_WORKFLOW_ACTIONS.has(String(action || '')); }
function actorLabel(email: string) { if (email === LEADER) return 'UAT 领导'; if (email === AI_DESIGNER) return 'Davis AI设计师'; return 'UAT 需求方'; }
function parseHistory(task: any) { try { const h = JSON.parse(String(task?.history_json || '[]')); return Array.isArray(h) ? h : []; } catch { return []; } }
function errorMessage(error: any) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') return String(error.message || error.details || error.hint || JSON.stringify(error));
  return String(error);
}
function latestRevisionFeedback(history: any[]) {
  for (let index = (history || []).length - 1; index >= 0; index -= 1) {
    const item = history[index] || {};
    if (!['requester_revision_feedback','reject_draft'].includes(String(item.action || ''))) continue;
    const feedback = String(item.reply || item.requester_feedback || '').trim();
    if (feedback) return { feedback, refresh_tencent_doc:Boolean(item.refresh_tencent_doc), time:item.time || item.created_at || '' };
  }
  return null;
}

async function appendHistory(admin: any, taskId: string, items: any[]) {
  const current = (await admin.from('test_tasks').select('history_json').eq('id', taskId).single()).data;
  const history = parseHistory(current);
  history.push(...items);
  await admin.from('test_tasks').update({ history_json: JSON.stringify(history) }).eq('id', taskId);
}

async function updateLatestFormalVersionStatus(admin: any, taskId: string, status: 'revision' | 'accepted') {
  const latest = (await admin.from('design_versions').select('id').eq('task_id', taskId).order('version_no', { ascending:false }).limit(1).maybeSingle()).data;
  if (!latest?.id) return;
  const { error } = await admin.from('design_versions').update({ status }).eq('id', latest.id);
  if (error) throw error;
}

async function supersedePreviousReview(admin: any, taskId: string) {
  const latest = (await admin.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending:false }).limit(1).maybeSingle()).data || null;
  if (String(latest?.status || '') === 'ready_for_review') {
    await admin.from('uat_content_revisions').update({ status:'superseded' }).eq('id', latest.id);
    await appendHistory(admin, taskId, [{ action:'content_revision_superseded', operator:'system', revision_id:latest.id, revision_no:latest.revision_no, time:new Date().toISOString(), desc:`第 ${latest.revision_no} 次修改已交付，需求方继续提出新意见，进入下一轮修改` }]);
  }
}

async function updateTaskAfterPrepared(admin: any, taskId: string, data: any) {
  const status = String(data?.status || '');
  if (status === 'content_ready') await admin.from('test_tasks').update({ status:'processing', summary_desc:`AI设计师已真实理解第 ${data?.revision?.revision_no || ''} 次修改，正在自动进入受影响页面生成` }).eq('id', taskId);
  else if (status === 'capacity_conflict') await admin.from('test_tasks').update({ status:'reviewing', summary_desc:'AI设计师已分析修改意见：新内容超出已通过母版容量，请需求方调整后重新提交' }).eq('id', taskId);
  else if (status === 'needs_input') await admin.from('test_tasks').update({ status:'needs_input', summary_desc:'AI设计师已真实理解修改意见，但仍有关键信息需要需求方补充' }).eq('id', taskId);
  else if (status === 'no_change') await admin.from('test_tasks').update({ status:'reviewing', summary_desc:'AI设计师已完成本轮理解，判断无需重新生图，可直接验收当前版本' }).eq('id', taskId);
}

async function recordUnderstanding(admin: any, taskId: string, data: any, feedback = '') {
  if (!data?.revision) return;
  await appendHistory(admin, taskId, [{
    action:'ai_content_revision_understood', operator:'Davis AI设计师', time:new Date().toISOString(),
    revision_id:data.revision.id, revision_no:data.revision.revision_no, analysis_id:data.revision.analysis_id,
    requester_feedback:feedback || data.revision.system_content || '', affected_pages:data.affected_pages || data.revision.affected_pages || [],
    desc:`AI 已完成第 ${data.revision.revision_no} 次修改理解，判断受影响页面为 ${(data.affected_pages || []).map((p:any)=>`P${p}`).join('、') || '无'}`,
  }]);
}

async function autoQueueIfReady(admin: any, taskId: string, data: any) {
  if (String(data?.status || '') !== 'content_ready' || !data?.revision?.id) return data;
  const key = `ai-content-revision:${taskId}:r${data.revision.revision_no}`;
  const queued = await queueContentRevision(admin, taskId, data.revision.id, key);
  await admin.from('uat_audit_log').insert({ actor_id:null, actor_email:AI_DESIGNER, action:'ai_designer_content_revision_generation_started', task_id:taskId, details:{ revision_id:data.revision.id, revision_no:data.revision.revision_no, affected_pages:data.affected_pages || [], generation_started:true } });
  return { ...queued, prepared:data, generation_started:true };
}

function scheduleAiGeneration(admin: any, taskId: string, data: any) {
  if (String(data?.status || '') !== 'content_ready' || !data?.revision?.id) return { ...data, generation_started:false };
  const job = autoQueueIfReady(admin, taskId, data).catch(async (error: any) => {
    const message = errorMessage(error);
    await admin.from('test_tasks').update({ status:'reviewing', summary_desc:`AI设计师生成排队失败：${message.slice(0,120)}；未创建或继续追加生成任务` }).eq('id', taskId);
    await admin.from('uat_audit_log').insert({ actor_id:null, actor_email:AI_DESIGNER, action:'ai_designer_content_revision_generation_schedule_failed', task_id:taskId, details:{ revision_id:data.revision.id, revision_no:data.revision.revision_no, error:message, generation_started:false } });
  });
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(job);
  else void job;
  return { ...data, status:'processing', ai_generation_scheduled:true, generation_started:false };
}

async function loadResolvedRevisionInstruction(admin: any, taskId: string, context: any) {
  let clarificationQuery = admin.from('uat_clarifications')
    .select('question,answer,answered_at')
    .eq('task_id', taskId)
    .eq('status', 'answered')
    .order('answered_at', { ascending:true });
  let messageQuery = admin.from('uat_clarification_messages')
    .select('content,created_at')
    .eq('task_id', taskId)
    .eq('sender_role', 'requester')
    .eq('message_type', 'message')
    .order('created_at', { ascending:true });
  if (context?.time) {
    clarificationQuery = clarificationQuery.gt('answered_at', context.time);
    messageQuery = messageQuery.gt('created_at', context.time);
  }
  const [clarificationsResult, messagesResult] = await Promise.all([clarificationQuery, messageQuery]);
  if (clarificationsResult.error) throw clarificationsResult.error;
  if (messagesResult.error) throw messagesResult.error;
  return buildRevisionInstruction({
    originalFeedback:context.feedback,
    clarifications:clarificationsResult.data || [],
    messages:(messagesResult.data || []).map((item:any) => String(item.content || '')).filter(Boolean),
  });
}

async function continueRevisionAfterClarification(admin: any, task: any, taskId: string, body: any, auth: any, jwt: string) {
  const history = parseHistory((await admin.from('test_tasks').select('history_json').eq('id', taskId).single()).data || task);
  const context = latestRevisionFeedback(history);
  if (!context?.feedback) throw new Error('REQUESTER_REVISION_FEEDBACK_REQUIRED');
  const clientRequestId = String(body.client_request_id || crypto.randomUUID()).trim();
  await saveRequesterAnswers(admin, taskId, body.answers || [], String(body.message || ''), clientRequestId, auth.user.id);
  await saveAiProcessingAck(admin, taskId, clientRequestId, 'answer_clarifications');
  const resolvedFeedback = await loadResolvedRevisionInstruction(admin, taskId, context);
  await appendHistory(admin, taskId, [{
    action:'content_revision_clarification_answered', operator:actorLabel(String(auth.user.email || '').toLowerCase()),
    time:new Date().toISOString(), reply:String(body.message || '').trim() || (body.answers || []).map((item:any)=>String(item?.answer || '')).filter(Boolean).join('；'),
    requester_feedback:context.feedback, resolved_requester_feedback:resolvedFeedback, generation_started:false,
  }]);
  await admin.from('test_tasks').update({ status:'reviewing', summary_desc:'需求方已补充本轮修改信息，AI设计师正在继续真实理解' }).eq('id', taskId);
  const prepared = await prepareContentRevision(admin, taskId, auth.user.id, {
    source_mode:context.refresh_tencent_doc ? 'combined' : 'system_text',
    system_content:resolvedFeedback,
    requester_feedback:resolvedFeedback,
    use_tencent_doc:context.refresh_tencent_doc,
    user_jwt:jwt,
  }, { analyze:analyzeRequirement });
  await recordUnderstanding(admin, taskId, prepared, resolvedFeedback);
  await updateTaskAfterPrepared(admin, taskId, prepared);
  await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:auth.user.email, action:'content_revision_clarification_answered', task_id:taskId, details:{ status:prepared?.status, requester_feedback:context.feedback, resolved_requester_feedback:resolvedFeedback, affected_pages:prepared?.affected_pages || [], generation_started:false } });
  return prepared;
}

export async function handleTemplateWorkflowAction(args: any) {
  const { admin, task, taskId, action, body, auth, jwt } = args;
  const email = String(auth?.user?.email || '').toLowerCase();
  if (!isTemplateWorkflowAction(action)) return { handled:false };
  if (task?.assignee !== 'davis.design.ai') return { handled:true, status:400, body:{ ok:false, error:'Task is not assigned to UAT AI' } };
  try {
    const role = assertTemplateWorkflowActor(action, email);
    if (action === 'approve_framework' || action === 'reject_framework') {
      const actor = { id:auth.user.id, email, label:actorLabel(email) };
      const data = action === 'approve_framework' ? await approveFramework(admin, taskId, actor, String(body.note || '')) : await rejectFramework(admin, taskId, actor, String(body.reason || ''));
      await updateLatestFormalVersionStatus(admin, taskId, action === 'approve_framework' ? 'accepted' : 'revision');
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action, task_id:taskId, details:{ status:data.task?.status, template_id:data.template?.id || null } });
      return { handled:true, status:200, body:{ ok:true, status:data.task?.status, data } };
    }

    if (action === 'submit_content_revision_request') {
      await updateLatestFormalVersionStatus(admin, taskId, 'revision');
      await supersedePreviousReview(admin, taskId);
      const feedback = String(body.requester_feedback || '').trim();
      const data = await submitRequesterRevisionRequest(admin, task, auth.user.id, { ...body, user_jwt:jwt }, { refreshSources:ingestTaskSources, prepare:prepareContentRevision, prepareDeps:{ analyze:analyzeRequirement } });
      await appendHistory(admin, taskId, [{ action:'requester_revision_feedback', operator:actorLabel(email), reply:feedback, requester_feedback:feedback, refresh_tencent_doc:Boolean(body.refresh_tencent_doc), time:new Date().toISOString(), generation_started:false, revision_id:data?.revision?.id || null, revision_no:data?.revision?.revision_no || null }]);
      await recordUnderstanding(admin, taskId, data, feedback);
      await updateTaskAfterPrepared(admin, taskId, data);
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action:'requester_revision_request_submitted', task_id:taskId, details:{ status:data?.status, requester_feedback:feedback, refresh_tencent_doc:Boolean(body.refresh_tencent_doc), affected_pages:data?.affected_pages || [], generation_started:false } });
      const result = scheduleAiGeneration(admin, taskId, data);
      return { handled:true, status:String(result?.status || '') === 'processing' ? 202 : 200, body:{ ok:true, ...result } };
    }

    if (action === 'answer_content_revision_clarification') {
      const prepared = await continueRevisionAfterClarification(admin, task, taskId, body, auth, jwt);
      const result = scheduleAiGeneration(admin, taskId, prepared);
      return { handled:true, status:String(result?.status || '') === 'processing' ? 202 : 200, body:{ ok:true, ...result } };
    }

    if (action === 'accept_current_revision') {
      const data = await acceptCurrentRevision(admin, taskId, actorLabel(email));
      await updateLatestFormalVersionStatus(admin, taskId, 'accepted');
      return { handled:true, status:200, body:{ ok:true, ...data } };
    }

    if (action === 'generate_framework_revision') {
      const data = await generateFrameworkRevision(admin, taskId, auth.user.id, { ...body, user_jwt:jwt }, { refreshSources:ingestTaskSources, analyze:analyzeRequirement, confirmAnalysis:confirmUnderstanding });
      return { handled:true, status:202, body:{ ok:true, ...data } };
    }

    if (action === 'check_content_update') {
      const data = await checkContentUpdate(admin, taskId, auth.user.id, { refreshSources:ingestTaskSources });
      return { handled:true, status:200, body:{ ok:true, ...data } };
    }

    if (action === 'prepare_content_revision') {
      await supersedePreviousReview(admin, taskId);
      if (body?.refresh_tencent_doc) await ingestTaskSources(admin, task, auth.user.id);
      const data = await prepareContentRevision(admin, taskId, auth.user.id, { ...body, user_jwt:jwt }, { analyze:analyzeRequirement });
      await recordUnderstanding(admin, taskId, data, String(body.requester_feedback || body.system_content || ''));
      await updateTaskAfterPrepared(admin, taskId, data);
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action:'ai_designer_content_revision_analyzed', task_id:taskId, details:{ status:data?.status, affected_pages:data?.affected_pages || [], generation_started:false } });
      const result = await autoQueueIfReady(admin, taskId, data);
      return { handled:true, status:String(result?.status || '') === 'processing' ? 202 : 200, body:{ ok:true, ...result } };
    }

    if (action === 'generate_content_revision') {
      const revisionId = String(body.revision_id || '');
      const revision = (await admin.from('uat_content_revisions').select('*').eq('id', revisionId).eq('task_id', taskId).single()).data;
      if (!revision) throw new Error('CONTENT_REVISION_NOT_FOUND');
      const data = await queueContentRevision(admin, taskId, revisionId, String(body.idempotency_key || ''));
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action:'ai_designer_content_revision_generation_started', task_id:taskId, details:{ revision_id:revisionId, revision_no:revision.revision_no, affected_pages:revision.affected_pages || [], generation_started:true } });
      return { handled:true, status:202, body:{ ok:true, ...data } };
    }

    throw new Error(`UNHANDLED_TEMPLATE_WORKFLOW_ACTION:${role}`);
  } catch (error) {
    const message = errorMessage(error);
    const status = /FORBIDDEN/.test(message) ? 403 : /NOT_FOUND/.test(message) ? 404 : 400;
    return { handled:true, status, body:{ ok:false, error:message } };
  }
}
