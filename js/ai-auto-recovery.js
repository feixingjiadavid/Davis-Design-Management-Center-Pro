import { startAutomaticAnalysis } from './ai-requirement-client.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function shouldRecoverNeedsInput({ taskStatus, openClarificationCount, brief }) {
  if (taskStatus !== 'needs_input') return false;
  if (Number(openClarificationCount || 0) > 0) return false;
  const missing = Array.isArray(brief?.missing_information) ? brief.missing_information : [];
  const questions = Array.isArray(brief?.clarification_questions) ? brief.clarification_questions : [];
  return missing.length === 0 && questions.length === 0;
}

async function canRecoverTask(supabase, task) {
  const { count: referenceCount } = await supabase
    .from('uat_visual_references')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', task.id);
  if (!referenceCount) return false;

  if (task.status === 'analysis_failed') return true;
  if (task.status !== 'needs_input') return false;

  const { data: latestAnalysis, error: analysisError } = await supabase
    .from('uat_requirement_analyses')
    .select('id,brief,status,version')
    .eq('task_id', task.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (analysisError || !latestAnalysis) return false;

  const { count: openClarificationCount, error: clarificationError } = await supabase
    .from('uat_clarifications')
    .select('id', { count: 'exact', head: true })
    .eq('analysis_id', latestAnalysis.id)
    .eq('status', 'open');
  if (clarificationError) return false;

  return shouldRecoverNeedsInput({
    taskStatus: task.status,
    openClarificationCount,
    brief: latestAnalysis.brief,
  });
}

export async function bootstrapAiAutoRecovery(supabase) {
  const path = location.pathname.split('/').pop() || '';
  if (path !== 'ai-designer-workspace.html') return;
  if (window.__davisAiAutoRecoveryStarted) return;
  window.__davisAiAutoRecoveryStarted = true;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) break;
    await sleep(150);
  }

  const { data: tasks, error } = await supabase
    .from('test_tasks')
    .select('id,status,assignee,created_at')
    .eq('assignee', 'davis.design.ai')
    .in('status', ['analysis_failed', 'needs_input'])
    .order('created_at', { ascending: false });
  if (error || !tasks?.length) return;

  for (const task of tasks) {
    const key = `davis-ai-auto-recovery:${task.id}:state-v46`;
    if (sessionStorage.getItem(key)) continue;
    if (!await canRecoverTask(supabase, task)) continue;

    sessionStorage.setItem(key, '1');
    try {
      await startAutomaticAnalysis(supabase, task.id);
      setTimeout(() => location.reload(), 2500);
    } catch (error) {
      console.error('AI 自动恢复失败:', task.id, error);
    }
    break;
  }
}
