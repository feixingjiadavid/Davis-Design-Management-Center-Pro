import { startAutomaticAnalysis } from './ai-requirement-client.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    .select('id,status,assignee')
    .eq('assignee', 'davis.design.ai')
    .eq('status', 'analysis_failed')
    .order('created_at', { ascending: false });
  if (error || !tasks?.length) return;

  for (const task of tasks) {
    const key = `davis-ai-auto-recovery:${task.id}:qwen-v45`;
    if (sessionStorage.getItem(key)) continue;
    const { count } = await supabase
      .from('uat_visual_references')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', task.id);
    if (!count) continue;
    sessionStorage.setItem(key, '1');
    try {
      await startAutomaticAnalysis(supabase, task.id);
      setTimeout(() => location.reload(), 1800);
    } catch (error) {
      console.error('AI 自动恢复失败:', task.id, error);
    }
    break;
  }
}
