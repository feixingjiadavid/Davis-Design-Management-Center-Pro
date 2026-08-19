import { approveFramework, rejectFramework } from './framework-lifecycle-service.ts';
import { generateFrameworkRevision } from './framework-adjustment-service.ts';
import { acceptCurrentRevision, checkContentUpdate, prepareContentRevision, queueContentRevision } from './content-revision-service.ts';
import { ingestTaskSources } from './source-service.ts';
import { analyzeRequirement, confirmUnderstanding } from './analysis-service.ts';

const LEADER = 'uat.leader@webank.com';
const REQUESTER = 'uat.requester@webank.com';

export const TEMPLATE_WORKFLOW_ACTIONS = new Set([
  'approve_framework',
  'reject_framework',
  'generate_framework_revision',
  'check_content_update',
  'prepare_content_revision',
  'generate_content_revision',
  'accept_current_revision',
]);

export function isTemplateWorkflowAction(action: string) {
  return TEMPLATE_WORKFLOW_ACTIONS.has(String(action || ''));
}

function actorLabel(email: string) {
  return email === LEADER ? 'UAT 领导' : 'UAT 需求方';
}

export async function handleTemplateWorkflowAction(args: any) {
  const { admin, task, taskId, action, body, auth, jwt } = args;
  const email = String(auth?.user?.email || '').toLowerCase();
  if (!isTemplateWorkflowAction(action)) return { handled: false };
  if (task?.assignee !== 'davis.design.ai') {
    return { handled: true, status: 400, body: { ok: false, error: 'Task is not assigned to UAT AI' } };
  }

  try {
    if (action === 'approve_framework' || action === 'reject_framework') {
      if (email !== LEADER) throw new Error('LEADER_ACTION_FORBIDDEN');
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

    if (email !== REQUESTER) throw new Error('REQUESTER_ACTION_FORBIDDEN');

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
      return { handled: true, status: 200, body: { ok: true, ...data } };
    }

    if (action === 'generate_content_revision') {
      const data = await queueContentRevision(admin, taskId, String(body.revision_id || ''), String(body.idempotency_key || ''));
      return { handled: true, status: 202, body: { ok: true, ...data } };
    }

    if (action === 'accept_current_revision') {
      const data = await acceptCurrentRevision(admin, taskId, actorLabel(email));
      return { handled: true, status: 200, body: { ok: true, ...data } };
    }

    return { handled: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /FORBIDDEN/.test(message) ? 403 : /NOT_FOUND/.test(message) ? 404 : 400;
    return { handled: true, status, body: { ok: false, error: message } };
  }
}
