import { buildRevisionManifest, diffFixedTemplatePages } from './framework-template-core.ts';

export async function sha256Text(text: string) {
  const data = new TextEncoder().encode(String(text || '').replace(/\r\n/g, '\n').trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSystem(value: any) { return String(value || '').replace(/\r\n/g, '\n').trim(); }

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
  if (String(task.status) !== 'reviewing') throw new Error('TASK_NOT_IN_REQUESTER_REVIEW');
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
  if (newHash && previousHash && newHash === previousHash) return { status: 'no_change', changed: false, revision: null, affected_pages: [] };

  const augmentedTask = {
    ...task,
    full_desc: [String(task.full_desc || ''), systemContent ? `本轮业务内容更新：${systemContent}` : ''].filter(Boolean).join('\n\n'),
  };
  const analysis = await deps.analyze(admin, augmentedTask, payload?.user_jwt || '');
  if (String(analysis.status) === 'clarification_required') return { status: 'needs_input', analysis, revision: null, affected_pages: [] };
  if (!['understanding_ready', 'confirmed'].includes(String(analysis.status))) throw new Error('ANALYSIS_NOT_READY');

  const rawPages = Array.isArray(analysis?.brief?.pages) ? analysis.brief.pages : [];
  const templatePages = Array.isArray(template.pages) ? template.pages : [];
  const fixedPages = rawPages.length === templatePages.length
    ? rawPages.map((page: any, index: number) => ({ ...page, index: Number(templatePages[index].page_index), title: String(templatePages[index].page_title) }))
    : rawPages;
  const diff = diffFixedTemplatePages(templatePages, fixedPages);
  const nextRevisionNo = Number(latest?.revision_no || 0) + 1;
  const previousManifest = Array.isArray(latest?.page_manifest) && latest.page_manifest.length ? latest.page_manifest : templateManifest(template);
  const manifest = buildRevisionManifest(templatePages, previousManifest, []);

  if (!diff.capacityConflict && diff.affectedPages.length === 0) {
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
    change_summary: { reason: diff.reason || null },
    affected_pages: diff.affectedPages,
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
    affected_pages: diff.affectedPages,
    reason: diff.reason || null,
  };
}
