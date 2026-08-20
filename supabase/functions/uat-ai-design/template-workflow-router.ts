import { approveFramework, rejectFramework } from './framework-lifecycle-service.ts';
import { generateFrameworkRevision } from './framework-adjustment-service.ts';
import { acceptCurrentRevision, checkContentUpdate, prepareContentRevision, queueContentRevision } from './content-revision-service.ts';
import { submitRequesterRevisionRequest } from './content-revision-request.mjs';
import { ingestTaskSources } from './source-service.ts';
import { analyzeRequirement, confirmUnderstanding } from './analysis-service.ts';
import { assertTemplateWorkflowActor } from './template-workflow-permissions.mjs';

const LEADER = 'uat.leader@webank.com';
const REQUESTER = 'uat.requester@webank.com';
const AI_DESIGNER = 'davis.design.ai@webank.com';

export const TEMPLATE_WORKFLOW_ACTIONS = new Set([
  'approve_framework','reject_framework','generate_framework_revision','check_content_update',
  'prepare_content_revision','generate_content_revision','submit_content_revision_request','accept_current_revision',
]);

export function isTemplateWorkflowAction(action: string) { return TEMPLATE_WORKFLOW_ACTIONS.has(String(action || '')); }
function actorLabel(email: string) { if (email === LEADER) return 'UAT 领导'; if (email === AI_DESIGNER) return 'Davis AI设计师'; return 'UAT 需求方'; }
function parseHistory(task: any) { try { const h = JSON.parse(String(task?.history_json || '[]')); return Array.isArray(h) ? h : []; } catch { return []; } }

async function appendHistory(admin: any, taskId: string, items: any[]) {
  const current = (await admin.from('test_tasks').select('history_json').eq('id', taskId).single()).data;
  const history = parseHistory(current);
  history.push(...items);
  await admin.from('test_tasks').update({ history_json: JSON.stringify(history) }).eq('id', taskId);
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
  if (status === 'content_ready') await admin.from('test_tasks').update({ status:'processing', summary_desc:`AI设计师已理解第 ${data?.revision?.revision_no || ''} 次修改，正在自动进入受影响页面生成` }).eq('id', taskId);
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

async function normalizeAiGenerationHistory(admin: any, taskId: string, revision: any, generations: any[]) {
  const current = (await admin.from('test_tasks').select('history_json').eq('id', taskId).single()).data;
  const history = parseHistory(current);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (String(item?.action || '') === 'content_revision_submitted' && Number(item?.revision_no || 0) === Number(revision?.revision_no || 0)) {
      history[index] = { ...item, action:'content_revision_generation_started', operator:'Davis AI设计师', generated_by:'ai_designer', desc:`AI 设计师开始第 ${revision.revision_no} 次修改生成`, time:item.time || new Date().toISOString() };
      break;
    }
  }
  await admin.from('test_tasks').update({ history_json:JSON.stringify(history), status:'processing', summary_desc:`AI设计师正在执行第 ${revision.revision_no} 次内容修改，生成 ${(revision.affected_pages || []).map((p:any)=>`P${p}`).join('、')}` }).eq('id', taskId);
  for (const generation of generations || []) {
    await admin.from('uat_design_generations').update({ output:{ ...(generation.output || {}), queued_by:AI_DESIGNER, revision_no:revision.revision_no } }).eq('id', generation.id);
  }
}

async function autoQueueIfReady(admin: any, taskId: string, data: any) {
  if (String(data?.status || '') !== 'content_ready' || !data?.revision?.id) return data;
  const key = `ai-content-revision:${taskId}:r${data.revision.revision_no}`;
  const queued = await queueContentRevision(admin, taskId, data.revision.id, key);
  await normalizeAiGenerationHistory(admin, taskId, data.revision, queued.generations || []);
  await admin.from('uat_audit_log').insert({ actor_id:null, actor_email:AI_DESIGNER, action:'ai_designer_content_revision_generation_started', task_id:taskId, details:{ revision_id:data.revision.id, revision_no:data.revision.revision_no, affected_pages:data.affected_pages || [], generation_started:true } });
  return { ...queued, prepared:data, generation_started:true };
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
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action, task_id:taskId, details:{ status:data.task?.status, template_id:data.template?.id || null } });
      return { handled:true, status:200, body:{ ok:true, status:data.task?.status, data } };
    }

    if (action === 'submit_content_revision_request') {
      await supersedePreviousReview(admin, taskId);
      const feedback = String(body.requester_feedback || '').trim();
      const data = await submitRequesterRevisionRequest(admin, task, auth.user.id, { ...body, user_jwt:jwt }, { refreshSources:ingestTaskSources, prepare:prepareContentRevision, prepareDeps:{ analyze:analyzeRequirement } });
      await appendHistory(admin, taskId, [{ action:'requester_revision_feedback', operator:actorLabel(email), reply:feedback, requester_feedback:feedback, refresh_tencent_doc:Boolean(body.refresh_tencent_doc), time:new Date().toISOString(), generation_started:false, revision_id:data?.revision?.id || null, revision_no:data?.revision?.revision_no || null }]);
      await recordUnderstanding(admin, taskId, data, feedback);
      await updateTaskAfterPrepared(admin, taskId, data);
      await admin.from('uat_audit_log').insert({ actor_id:auth.user.id, actor_email:email, action:'requester_revision_request_submitted', task_id:taskId, details:{ status:data?.status, requester_feedback:feedback, refresh_tencent_doc:Boolean(body.refresh_tencent_doc), affected_pages:data?.affected_pages || [], generation_started:false } });
      const result = await autoQueueIfReady(admin, taskId, data);
      const responseStatus = String(result?.status || '') === 'processing' ? 202 : 200;
      return { handled:true, status:responseStatus, body:{ ok:true, ...result } };
    }

    if (action === 'accept_current_revision') {
      const data = await acceptCurrentRevision(admin, taskId, actorLabel(email));
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
      const data = await queueContentRevision(admin, taskId, String(body.revision_id || ''), String(body.idempotency_key || ''));
      await normalizeAiGenerationHistory(admin, taskId, data.revision, data.generations || []);
      return { handled:true, status:202, body:{ ok:true, ...data } };
    }

    throw new Error(`UNHANDLED_TEMPLATE_WORKFLOW_ACTION:${role}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /FORBIDDEN/.test(message) ? 403 : /NOT_FOUND/.test(message) ? 404 : 400;
    return { handled:true, status, body:{ ok:false, error:message } };
  }
}
