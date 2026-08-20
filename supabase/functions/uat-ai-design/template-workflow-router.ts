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
  'approve_framework',
  'reject_framework',
  'generate_framework_revision',
  'check_content_update',
  'prepare_content_revision',
  'generate_content_revision',
  'submit_content_revision_request',
  'accept_current_revision',
]);

export function isTemplateWorkflowAction(action: string) {
  return TEMPLATE_WORKFLOW_ACTIONS.has(String(action || ''));
}

function actorLabel(email: string) {
  if (email === LEADER) return 'UAT 领导';
  if (email === AI_DESIGNER) return 'Davis AI设计师';
  return 'UAT 需求方';
}

function parseHistory(task: any) {
  try {
    const history = JSON.parse(String(task?.history_json || '[]'));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

async function updateTaskAfterPrepared(admin: any, taskId: string, data: any, fallback = '') {
  const status = String(data?.status || '');
  if (status === 'content_ready') {
    await admin.from('test_tasks').update({
      status: 'reviewing',
      summary_desc: 'AI设计师已理解需求方修改意见，等待 AI 设计师执行修改；尚未生图',
    }).eq('id', taskId);
  } else if (status === 'capacity_conflict') {
    await admin.from('test_tasks').update({
      status: 'reviewing',
      summary_desc: 'AI设计师已分析修改意见：新内容超出已通过母版容量，请需求方调整后重新提交',
    }).eq('id', taskId);
  } else if (status === 'needs_input') {
    await admin.from('test_tasks').update({
      status: 'needs_input',
      summary_desc: 'AI设计师已理解修改意见，但仍有关键信息需要需求方补充',
    }).eq('id', taskId);
  } else if (status === 'no_change') {
    await admin.from('test_tasks').update({
      status: 'reviewing',
      summary_desc: 'AI设计师已检查修改意见，当前无需重新生成，可直接验收',
    }).eq('id', taskId);
  } else if (fallback) {
    await admin.from('test_tasks').update({ summary_desc: fallback }).eq('id', taskId);
  }
}

export async function handleTemplateWorkflowAction(args: any) {
  const { admin, task, taskId, action, body, auth, jwt } = args;
  const email = String(auth?.user?.email || '').toLowerCase();
  if (!isTemplateWorkflowAction(action)) return { handled: false };
  if (task?.assignee !== 'davis.design.ai') {
    return { handled: true, status: 400, body: { ok: false, error: 'Task is not assigned to UAT AI' } };
  }

  try {
    const role = assertTemplateWorkflowActor(action, email);

    if (action === 'approve_framework' || action === 'reject_framework') {
      const actor = { id: auth.user.id, email, label: actorLabel(email) };
      const data = action === 'approve_framework'
        ? await approveFramework(admin, taskId, actor, String(body.note || ''))
        : await rejectFramework(admin, taskId, actor, String(body.reason || ''));
      await admin.from('uat_audit_log').insert({
        actor_id: auth.user.id,
        actor_email: email,
        action,
        task_id: taskId,
        details: { status: data.task?.status, template_id: data.template?.id || null },
      });
      return { handled: true, status: 200, body: { ok: true, status: data.task?.status, data } };
    }

    if (action === 'submit_content_revision_request') {
      const feedback = String(body.requester_feedback || '').trim();
      const data = await submitRequesterRevisionRequest(admin, task, auth.user.id, {
        ...body,
        user_jwt: jwt,
      }, {
        refreshSources: ingestTaskSources,
        prepare: prepareContentRevision,
        prepareDeps: { analyze: analyzeRequirement },
      });
      const status = String(data?.status || '');
      const history = parseHistory(task);
      history.push({
        action: 'requester_revision_feedback',
        operator: actorLabel(email),
        reply: feedback,
        requester_feedback: feedback,
        refresh_tencent_doc: Boolean(body.refresh_tencent_doc),
        time: new Date().toISOString(),
        generation_started: false,
        revision_id: data?.revision?.id || null,
      });
      await admin.from('test_tasks').update({ history_json: JSON.stringify(history) }).eq('id', taskId);
      await updateTaskAfterPrepared(admin, taskId, data);
      await admin.from('uat_audit_log').insert({
        actor_id: auth.user.id,
        actor_email: email,
        action: 'requester_revision_request_submitted',
        task_id: taskId,
        details: {
          status,
          requester_feedback: feedback,
          refresh_tencent_doc: Boolean(body.refresh_tencent_doc),
          affected_pages: data?.affected_pages || [],
          generation_started: false,
        },
      });
      return { handled: true, status: 200, body: { ok: true, ...data, generation_started: false } };
    }

    if (action === 'accept_current_revision') {
      const data = await acceptCurrentRevision(admin, taskId, actorLabel(email));
      return { handled: true, status: 200, body: { ok: true, ...data } };
    }

    if (action === 'generate_framework_revision') {
      const data = await generateFrameworkRevision(admin, taskId, auth.user.id, { ...body, user_jwt: jwt }, {
        refreshSources: ingestTaskSources,
        analyze: analyzeRequirement,
        confirmAnalysis: confirmUnderstanding,
      });
      return { handled: true, status: 202, body: { ok: true, ...data } };
    }

    if (action === 'check_content_update') {
      const data = await checkContentUpdate(admin, taskId, auth.user.id, { refreshSources: ingestTaskSources });
      return { handled: true, status: 200, body: { ok: true, ...data } };
    }

    if (action === 'prepare_content_revision') {
      if (body?.refresh_tencent_doc) await ingestTaskSources(admin, task, auth.user.id);
      const data = await prepareContentRevision(admin, taskId, auth.user.id, { ...body, user_jwt: jwt }, { analyze: analyzeRequirement });
      await updateTaskAfterPrepared(admin, taskId, data);
      await admin.from('uat_audit_log').insert({
        actor_id: auth.user.id,
        actor_email: email,
        action: 'ai_designer_content_revision_analyzed',
        task_id: taskId,
        details: { status: data?.status, affected_pages: data?.affected_pages || [], generation_started: false },
      });
      return { handled: true, status: 200, body: { ok: true, ...data, generation_started: false } };
    }

    if (action === 'generate_content_revision') {
      const data = await queueContentRevision(admin, taskId, String(body.revision_id || ''), String(body.idempotency_key || ''));
      await admin.from('uat_audit_log').insert({
        actor_id: auth.user.id,
        actor_email: email,
        action: 'ai_designer_content_revision_generation_started',
        task_id: taskId,
        details: { revision_id: String(body.revision_id || ''), generation_started: true },
      });
      return { handled: true, status: 202, body: { ok: true, ...data } };
    }

    throw new Error(`UNHANDLED_TEMPLATE_WORKFLOW_ACTION:${role}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /FORBIDDEN/.test(message) ? 403 : /NOT_FOUND/.test(message) ? 404 : 400;
    return { handled: true, status, body: { ok: false, error: message } };
  }
}
