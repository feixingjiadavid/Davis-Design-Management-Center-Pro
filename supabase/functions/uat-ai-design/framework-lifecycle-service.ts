import { assertFrameworkCanBeApproved, assertFrameworkCanBeRejected, latestSubmittedFramework, validateTemplatePages } from './framework-template-core.ts';
import { selectCompleteFrameworkGenerationGroup } from './formal-framework-submission.mjs';

export type WorkflowActor = { id: string; email?: string; label: string };

function parseHistory(task: any) {
  try {
    const history = JSON.parse(String(task?.history_json || '[]'));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function outputOf(row: any) {
  if (row?.output && typeof row.output === 'object') return row.output;
  try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; }
}

async function currentSourceHash(admin: any, task: any) {
  let query = admin.from('uat_requirement_sources').select('*').eq('task_id', task.id).eq('status', 'ready');
  const link = String(task.link || '').trim();
  if (link) query = query.eq('source_type', 'tencent_doc').eq('source_url', link);
  else query = query.eq('source_type', 'form_fields');
  const source = (await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()).data;
  if (!source?.current_snapshot_id) return '';
  const snapshot = (await admin.from('uat_source_snapshots').select('content_sha256').eq('id', source.current_snapshot_id).single()).data;
  return String(snapshot?.content_sha256 || '');
}

async function canonicalFrameworkSubmission(admin: any, taskId: string) {
  const versionResult = await admin.from('design_versions').select('id,version_no,version_name,status').eq('task_id', taskId).eq('version_no', 1).maybeSingle();
  if (versionResult.error) throw versionResult.error;
  if (!versionResult.data) return null;
  const [assetsResult, generationsResult] = await Promise.all([
    admin.from('design_version_assets').select('sort_order,asset_url').eq('design_version_id', versionResult.data.id).order('sort_order', { ascending:true }),
    admin.from('uat_design_generations').select('*').eq('task_id', taskId).in('generation_mode', ['initial_framework','framework_revision']).in('status', ['ready','confirmed']).order('updated_at', { ascending:false }),
  ]);
  if (assetsResult.error) throw assetsResult.error;
  if (generationsResult.error) throw generationsResult.error;
  const generations = selectCompleteFrameworkGenerationGroup(generationsResult.data || [], assetsResult.data || []);
  if (!generations.length) throw new Error('FORMAL_FRAMEWORK_GENERATIONS_MISMATCH');
  return {
    version:'v1',
    ai_analysis_id:generations[0]?.analysis_id || null,
    ai_demo_generation_ids:generations.map((row:any) => String(row.id)),
    generations,
  };
}

export async function rejectFramework(admin: any, taskId: string, actor: WorkflowActor, reason = '') {
  const taskResult = await admin.from('test_tasks').select('*').eq('id', taskId).single();
  if (taskResult.error || !taskResult.data) throw new Error('TASK_NOT_FOUND');
  const task = taskResult.data;
  const history = parseHistory(task);
  const submitted = await canonicalFrameworkSubmission(admin, taskId) || latestSubmittedFramework(history);
  assertFrameworkCanBeRejected(task, submitted ? [...history, { action:'submit_framework' }] : history);
  const reply = String(reason || '').trim() || '框架方向不合适，请需求方与领导沟通后补充明确调整要求。';
  history.push({
    action: 'reject_framework', version: String(submitted?.version || ''), reply,
    operator: actor.label, reply_by: actor.label, is_rejected: true, time: new Date().toISOString(),
  });
  const updated = await admin.from('test_tasks').update({
    status: 'rejected',
    summary_desc: `领导驳回框架：${reply}`,
    history_json: JSON.stringify(history),
  }).eq('id', taskId).select('*').single();
  if (updated.error) throw updated.error;
  return { task: updated.data, submitted };
}

export async function approveFramework(admin: any, taskId: string, actor: WorkflowActor, note = '') {
  const taskResult = await admin.from('test_tasks').select('*').eq('id', taskId).single();
  if (taskResult.error || !taskResult.data) throw new Error('TASK_NOT_FOUND');
  const task = taskResult.data;
  const history = parseHistory(task);
  const canonical = await canonicalFrameworkSubmission(admin, taskId);
  const submitted: any = canonical || latestSubmittedFramework(history);
  assertFrameworkCanBeApproved(task, submitted ? [...history, { action:'submit_framework' }] : history);
  const existing = await admin.from('uat_framework_templates').select('id').eq('task_id', taskId).maybeSingle();
  if (existing.data) throw new Error('FRAMEWORK_TEMPLATE_ALREADY_LOCKED');

  const generationIds = Array.isArray(submitted?.ai_demo_generation_ids)
    ? submitted.ai_demo_generation_ids.map(String).filter(Boolean)
    : [];
  if (!generationIds.length) throw new Error('APPROVED_FRAMEWORK_GENERATIONS_REQUIRED');

  const result = await admin.from('uat_design_generations').select('*').eq('task_id', taskId).in('id', generationIds);
  if (result.error) throw result.error;
  const generations = (result.data || []).filter((row: any) => ['ready', 'confirmed'].includes(String(row.status)));
  if (generations.length !== generationIds.length) throw new Error('APPROVED_FRAMEWORK_GENERATIONS_NOT_READY');

  const pages = validateTemplatePages(generations
    .sort((a: any, b: any) => Number(a.page_index) - Number(b.page_index))
    .map((row: any) => {
      const output = outputOf(row);
      return {
        page_index: Number(row.page_index),
        page_title: String(output.page_title || `P${row.page_index}`),
        generation_id: row.id,
        drive_file_id: String(output.drive_file_id || ''),
        drive_url: String(output.drive_url || output.image_url || ''),
        exact_copy: Array.isArray(output.exact_copy) ? output.exact_copy.map(String) : [],
      };
    }));

  const first = outputOf(generations[0]);
  const width = Number(first?.size?.width || 1242);
  const height = Number(first?.size?.height || 1660);
  const approvalNote = String(note || '').trim();
  const sourceHash = String(submitted.source_content_hash || await currentSourceHash(admin, task) || '');
  const inserted = await admin.from('uat_framework_templates').insert({
    task_id: taskId,
    framework_version: String(submitted.version || 'v-1'),
    analysis_id: submitted.ai_analysis_id || generations[0]?.analysis_id || null,
    approved_by: actor.id,
    approved_by_label: actor.label,
    approved_at: new Date().toISOString(),
    approval_note: approvalNote || null,
    page_count: pages.length,
    width,
    height,
    source_content_hash: sourceHash || null,
    pages,
  }).select('*').single();
  if (inserted.error) throw inserted.error;

  history.push({
    action: 'approve_framework', version: String(submitted.version || ''), operator: actor.label,
    reply: approvalNote || '确认方向无误', is_rejected: false, reply_by: actor.label,
    time: new Date().toISOString(), template_id: inserted.data.id,
  });
  const updated = await admin.from('test_tasks').update({
    status: 'reviewing',
    summary_desc: '领导框架已通过，等待需求方验收或提交内容更新',
    history_json: JSON.stringify(history),
  }).eq('id', taskId).select('*').single();
  if (updated.error) throw updated.error;
  return { task: updated.data, template: inserted.data };
}
