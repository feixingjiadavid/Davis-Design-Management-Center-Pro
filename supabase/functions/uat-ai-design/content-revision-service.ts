import { buildRevisionManifest, diffFixedTemplatePages } from './framework-template-core.ts';
import { inferExplicitFeedbackPages, inferFeedbackAffectedPages, mergeAffectedPages } from './revision-feedback.mjs';

export const CONTENT_REVISION_MODEL = 'doubao-seedream-4-0-250828';
export const CONTENT_REVISION_PROMPT_VERSION = 'seedream-template-revision-v1';

export async function sha256Text(text: string) {
  const data = new TextEncoder().encode(String(text || '').replace(/\r\n/g, '\n').trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSystem(value: any) { return String(value || '').replace(/\r\n/g, '\n').trim(); }

function parseHistory(task: any) {
  try {
    const history = JSON.parse(String(task?.history_json || '[]'));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

async function taskAndTemplate(admin: any, taskId: string) {
  const [taskResult, templateResult] = await Promise.all([
    admin.from('test_tasks').select('*').eq('id', taskId).single(),
    admin.from('uat_framework_templates').select('*').eq('task_id', taskId).single(),
  ]);
  if (taskResult.error || !taskResult.data) throw new Error('TASK_NOT_FOUND');
  if (templateResult.error || !templateResult.data) throw new Error('FRAMEWORK_TEMPLATE_REQUIRED');
  return { task: taskResult.data, template: templateResult.data };
}

async function latestRevision(admin: any, taskId: string) {
  return (await admin.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending: false }).limit(1).maybeSingle()).data || null;
}

async function currentTencentSha(admin: any, task: any) {
  let query = admin.from('uat_requirement_sources').select('*').eq('task_id', task.id).eq('source_type', 'tencent_doc').eq('status', 'ready');
  if (String(task.link || '').trim()) query = query.eq('source_url', String(task.link).trim());
  const source = (await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()).data;
  if (!source?.current_snapshot_id) return '';
  const snapshot = (await admin.from('uat_source_snapshots').select('*').eq('id', source.current_snapshot_id).single()).data;
  return String(snapshot?.content_sha256 || '');
}

function templateManifest(template: any) {
  return (template.pages || []).map((page: any) => ({
    page_index: Number(page.page_index),
    source: 'template',
    generation_id: page.generation_id || null,
    drive_file_id: String(page.drive_file_id || ''),
    drive_url: String(page.drive_url || ''),
  }));
}

export async function checkContentUpdate(admin: any, taskId: string, actorId: string, deps: any = {}) {
  const { task, template } = await taskAndTemplate(admin, taskId);
  if (deps.refreshSources) await deps.refreshSources(admin, task, actorId);
  const currentHash = await currentTencentSha(admin, task);
  const latest = await latestRevision(admin, taskId);
  const previousHash = String(latest?.new_content_hash || template.source_content_hash || '');
  return {
    status: currentHash && currentHash !== previousHash ? 'changed' : 'no_change',
    changed: Boolean(currentHash && currentHash !== previousHash),
    previous_hash: previousHash,
    new_hash: currentHash,
  };
}

export async function prepareContentRevision(admin: any, taskId: string, actorId: string, payload: any, deps: any) {
  const { task, template } = await taskAndTemplate(admin, taskId);
  if (!['reviewing', 'rejected'].includes(String(task.status))) throw new Error('TASK_NOT_IN_REQUESTER_REVIEW');
  const systemContent = normalizeSystem(payload?.system_content);
  const mode = String(payload?.source_mode || ((systemContent && payload?.use_tencent_doc) ? 'combined' : systemContent ? 'system_text' : 'tencent_doc'));
  if (!['tencent_doc', 'system_text', 'combined'].includes(mode)) throw new Error('REVISION_SOURCE_MODE_INVALID');
  const tencentHash = await currentTencentSha(admin, task);
  if ((mode === 'tencent_doc' || mode === 'combined') && !tencentHash) throw new Error('TENCENT_SOURCE_SNAPSHOT_REQUIRED');
  if ((mode === 'system_text' || mode === 'combined') && !systemContent) throw new Error('SYSTEM_CONTENT_REQUIRED');

  const latest = await latestRevision(admin, taskId);
  const previousHash = String(latest?.new_content_hash || template.source_content_hash || '');
  const newHash = mode === 'tencent_doc'
    ? tencentHash
    : mode === 'system_text'
      ? await sha256Text(systemContent)
      : await sha256Text(`${tencentHash}\n${systemContent}`);
  if (!systemContent && newHash && previousHash && newHash === previousHash) {
    return { status: 'no_change', changed: false, revision: null, affected_pages: [] };
  }

  const augmentedTask = {
    ...task,
    full_desc: [
      String(task.full_desc || ''),
      systemContent ? `本轮需求方修改意见（AI设计师必须执行；可能是设计稿纠错，也可能是业务内容变化）：${systemContent}` : '',
    ].filter(Boolean).join('\n\n'),
    workflow_context: {
      ...(task.workflow_context || {}),
      mode: 'content_revision',
      requester_feedback: systemContent,
      rule: '领导已通过的框架母版不可更换。需求方反馈是本轮最高优先级修改指令；即使腾讯文档未变化，也必须处理设计稿纠错类意见。',
    },
  };
  const analysis = await deps.analyze(admin, augmentedTask, payload?.user_jwt || '');
  if (String(analysis.status) === 'clarification_required') {
    return { status: 'needs_input', analysis, revision: null, affected_pages: [] };
  }
  if (!['understanding_ready', 'confirmed'].includes(String(analysis.status))) throw new Error('ANALYSIS_NOT_READY');

  const rawPages = Array.isArray(analysis?.brief?.pages) ? analysis.brief.pages : [];
  const templatePages = Array.isArray(template.pages) ? template.pages : [];
  const fixedPages = rawPages.length === templatePages.length
    ? rawPages.map((page: any, index: number) => ({
      ...page,
      index: Number(templatePages[index].page_index),
      title: String(templatePages[index].page_title),
    }))
    : rawPages;
  const diff = diffFixedTemplatePages(templatePages, fixedPages);
  const explicitFeedbackPages = systemContent ? inferExplicitFeedbackPages(systemContent, templatePages) : [];
  const feedbackPages = systemContent
    ? (diff.affectedPages.length > 0 ? explicitFeedbackPages : inferFeedbackAffectedPages(systemContent, templatePages))
    : [];
  const affectedPages = explicitFeedbackPages.length
    ? explicitFeedbackPages
    : mergeAffectedPages(diff.affectedPages, feedbackPages);
  const nextRevisionNo = Number(latest?.revision_no || 0) + 1;
  const previousManifest = Array.isArray(latest?.page_manifest) && latest.page_manifest.length ? latest.page_manifest : templateManifest(template);
  const manifest = buildRevisionManifest(templatePages, previousManifest, []);

  if (!diff.capacityConflict && affectedPages.length === 0) {
    return { status: 'no_change', changed: false, revision: null, analysis, affected_pages: [] };
  }

  const inserted = await admin.from('uat_content_revisions').insert({
    task_id: taskId,
    template_id: template.id,
    analysis_id: analysis.id,
    revision_no: nextRevisionNo,
    source_mode: mode,
    system_content: systemContent || null,
    previous_content_hash: previousHash || null,
    new_content_hash: newHash || null,
    change_summary: {
      reason: diff.reason || null,
      requester_feedback: systemContent || null,
      content_diff_pages: diff.affectedPages,
      feedback_pages: feedbackPages,
    },
    affected_pages: affectedPages,
    page_manifest: manifest,
    status: diff.capacityConflict ? 'capacity_conflict' : 'content_ready',
    created_by: actorId,
    submitted_at: new Date().toISOString(),
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return {
    status: inserted.data.status,
    changed: true,
    revision: inserted.data,
    analysis,
    affected_pages: affectedPages,
    reason: diff.reason || null,
  };
}

export async function queueContentRevision(admin: any, taskId: string, revisionId: string, idempotencyKey: string) {
  const key = String(idempotencyKey || '').trim();
  if (!key) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const revision = (await admin.from('uat_content_revisions').select('*').eq('id', revisionId).eq('task_id', taskId).single()).data;
  if (!revision) throw new Error('CONTENT_REVISION_NOT_FOUND');

  const existing = (await admin.from('uat_design_generations').select('*').eq('revision_id', revisionId).in('status', ['queued', 'generating', 'ready'])).data || [];
  if (existing.length && ['content_ready', 'generating'].includes(String(revision.status))) {
    return { status: 'processing', revision, generations: existing, idempotent: true };
  }
  if (String(revision.status) !== 'content_ready') throw new Error('CONTENT_REVISION_NOT_READY');

  const template = (await admin.from('uat_framework_templates').select('*').eq('id', revision.template_id).eq('task_id', taskId).single()).data;
  if (!template) throw new Error('FRAMEWORK_TEMPLATE_REQUIRED');

  const affected = Array.isArray(revision.affected_pages) ? revision.affected_pages.map(Number).filter(Boolean) : [];
  if (!affected.length) throw new Error('AFFECTED_PAGES_REQUIRED');
  const rows = affected.map((pageIndex: number) => ({
    task_id: taskId,
    analysis_id: revision.analysis_id,
    kind: 'final',
    generation_mode: 'content_revision',
    template_id: revision.template_id,
    revision_id: revision.id,
    page_index: pageIndex,
    page_count: Number(template.page_count),
    model: CONTENT_REVISION_MODEL,
    prompt_version: CONTENT_REVISION_PROMPT_VERSION,
    idempotency_key: `${key}:p${pageIndex}`,
    status: 'queued',
    output: { run_id: key, queued_by: 'davis.design.ai@webank.com', revision_no: revision.revision_no },
  }));
  const inserted = await admin.from('uat_design_generations').insert(rows).select('*');
  if (inserted.error) throw inserted.error;
  await admin.from('uat_content_revisions').update({ status: 'generating' }).eq('id', revisionId);

  const task = (await admin.from('test_tasks').select('*').eq('id', taskId).single()).data;
  const history = parseHistory(task);
  history.push({
    action: 'content_revision_generation_started',
    revision_no: revision.revision_no,
    template_id: revision.template_id,
    source_mode: revision.source_mode,
    requester_feedback: revision.system_content || null,
    previous_content_hash: revision.previous_content_hash,
    new_content_hash: revision.new_content_hash,
    affected_pages: affected,
    operator: 'Davis AI设计师',
    generated_by: 'ai_designer',
    time: new Date().toISOString(),
  });
  await admin.from('test_tasks').update({
    status: 'processing',
    summary_desc: `AI设计师正在基于已通过母版处理第 ${revision.revision_no} 次内容修改`,
    history_json: JSON.stringify(history),
  }).eq('id', taskId);
  return {
    status: 'processing',
    revision: { ...revision, status: 'generating' },
    generations: inserted.data || [],
    idempotent: false,
  };
}

export async function acceptCurrentRevision(admin: any, taskId: string, actorLabel = 'UAT 需求方') {
  const task = (await admin.from('test_tasks').select('*').eq('id', taskId).single()).data;
  if (!task) throw new Error('TASK_NOT_FOUND');
  if (!['reviewing', 'rejected'].includes(String(task.status))) throw new Error('TASK_NOT_IN_REQUESTER_REVIEW');
  const template = (await admin.from('uat_framework_templates').select('*').eq('task_id', taskId).single()).data;
  if (!template) throw new Error('FRAMEWORK_TEMPLATE_REQUIRED');
  const revision = (await admin.from('uat_content_revisions').select('*').eq('task_id', taskId).eq('status', 'ready_for_review').order('revision_no', { ascending: false }).limit(1).maybeSingle()).data || null;
  if (revision) await admin.from('uat_content_revisions').update({ status: 'accepted' }).eq('id', revision.id);

  const history = parseHistory(task);
  history.push({
    action: 'complete',
    operator: `${actorLabel} (需求方)`,
    reply: revision ? `需求方验收内容改版 r${revision.revision_no}` : '需求方直接验收领导已通过框架 Demo',
    is_rejected: false,
    reply_by: `${actorLabel} (需求方)`,
    revision_id: revision?.id || null,
    template_id: template.id,
    time: new Date().toISOString(),
  });
  await admin.from('test_tasks').update({
    status: 'completed',
    summary_desc: '需求方已确认验收，任务圆满完结闭环。',
    history_json: JSON.stringify(history),
  }).eq('id', taskId);
  return { status: 'completed', accepted_revision_id: revision?.id || null, template_id: template.id };
}
