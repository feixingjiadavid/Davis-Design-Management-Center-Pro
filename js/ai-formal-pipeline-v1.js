import { resolveAiPipelineStage } from './formal-workflow-state.mjs?v=formal-workflow-state-v1';

let client = null;
let timer = null;
let lastSnapshot = '';

const labels = [
  '① 读取资料',
  '② 理解并追问',
  '③ Demo 版本',
  '④ 领导审核框架 Demo',
  '⑤ Seedream 4.0 成品',
  '⑥ 测试验收',
];

function ensurePipeline() {
  const pipeline = document.getElementById('pipeline');
  if (!pipeline) return null;
  if (pipeline.dataset.formalPipelineVersion !== '1') {
    pipeline.dataset.formalPipelineVersion = '1';
    pipeline.className = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3';
    pipeline.innerHTML = labels.map((label) => `<div class="step rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm">${label}</div>`).join('');
  }
  return pipeline;
}

function activeTaskId() {
  return String(document.querySelector('#taskList .task.active')?.dataset?.id || '').trim();
}

function parseHistory(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(String(raw || '[]')); } catch { return []; }
}

function hasDemo(task, history) {
  const status = String(task?.status || '');
  return history.some((item) => item?.action === 'submit_framework') ||
    ['pending_approval','ready_for_final','final_review','reviewing','completed','archived','rejected'].includes(status);
}

function hasFinal(task, history) {
  const status = String(task?.status || '');
  return history.some((item) => item?.action === 'submit_draft') ||
    ['final_review','reviewing','completed','archived'].includes(status);
}

function paint(stage) {
  const pipeline = ensurePipeline();
  if (!pipeline) return;
  [...pipeline.querySelectorAll('.step')].forEach((el, index) => {
    el.classList.remove('done', 'current');
    if (index < stage) el.classList.add('done');
    else if (index === stage) el.classList.add('current');
  });
}

async function sync() {
  if (!client) return;
  const taskId = activeTaskId();
  ensurePipeline();
  if (!taskId) return;

  const { data: task, error } = await client
    .from('test_tasks')
    .select('id,status,history_json')
    .eq('id', taskId)
    .single();
  if (error || !task) return;

  const history = parseHistory(task.history_json);
  const stage = resolveAiPipelineStage({
    status: task.status,
    hasDemo: hasDemo(task, history),
    hasFinal: hasFinal(task, history),
    history,
  });
  const snapshot = JSON.stringify({ id: task.id, status: task.status, stage, historyLength: history.length });
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;
  paint(stage);

  const active = document.querySelector('#taskList .task.active');
  if (active) {
    const statusBadge = active.querySelector('span.text-[11px]');
    if (statusBadge && task.status === 'pending_approval') statusBadge.textContent = '待领导审核框架';
  }
}

export function bootstrapAiFormalPipeline(clientInstance) {
  if (typeof window === 'undefined') return;
  if ((location.pathname.split('/').pop() || '') !== 'ai-designer-workspace.html') return;
  if (window.__aiFormalPipelineV1Started) return;
  window.__aiFormalPipelineV1Started = true;
  client = clientInstance;

  const start = () => {
    ensurePipeline();
    sync();
    timer = setInterval(sync, 1500);
    const taskList = document.getElementById('taskList');
    if (taskList) taskList.addEventListener('click', () => setTimeout(sync, 80), true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });
}
