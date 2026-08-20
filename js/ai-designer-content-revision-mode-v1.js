import { selectAiDesignerRevisionMode } from './ai-designer-content-revision-core.mjs?v=ai-content-revision-v1';
import { prepareContentRevision, generateContentRevision } from './ai-requirement-client.js?v=ai-content-revision-v1';

let sb = null;
let timer = null;
let busy = false;
let lastRenderKey = '';
const analysisAttempts = new Map();
const analysisErrors = new Map();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

function parseHistory(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const value = JSON.parse(String(raw || '[]'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function selectedTaskId() {
  return String(document.querySelector('#taskList .task.active')?.dataset?.id || '').trim();
}

async function loadContext(taskId) {
  const [taskResult, templateResult, revisionsResult] = await Promise.all([
    sb.from('test_tasks').select('*').eq('id', taskId).single(),
    sb.from('uat_framework_templates').select('*').eq('task_id', taskId).maybeSingle(),
    sb.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending: false }),
  ]);
  if (taskResult.error) throw taskResult.error;
  if (templateResult.error) throw templateResult.error;
  if (revisionsResult.error) throw revisionsResult.error;
  const task = taskResult.data;
  const template = templateResult.data || null;
  const revisions = revisionsResult.data || [];
  const revision = revisions[0] || null;
  const history = parseHistory(task.history_json);
  return { task, template, revisions, revision, history, mode: selectAiDesignerRevisionMode({ task, template, revision, history }) };
}

function paintPipeline(mode) {
  const pipeline = document.getElementById('pipeline');
  if (!pipeline) return;
  const stage = mode.kind === 'needs_analysis' ? 1
    : mode.kind === 'ready_to_generate' ? 2
    : mode.kind === 'generating' ? 2
    : mode.kind === 'requester_review' ? 3
    : mode.kind === 'capacity_conflict' || mode.kind === 'failed' ? 1
    : 1;
  pipeline.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
  const labels = ['① 母版已通过并锁定', '② 理解需求方修改', '③ AI 修改受影响页', '④ 需求方验收'];
  pipeline.innerHTML = labels.map((label, index) => {
    const cls = index < stage ? 'step done rounded-xl border p-3 text-sm' : index === stage ? 'step current rounded-xl border p-3 text-sm' : 'step rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm';
    return `<div class="${cls}">${label}</div>`;
  }).join('');
}

function affectedPages(revision) {
  return (revision?.affected_pages || []).map(Number).filter(Boolean).sort((a, b) => a - b);
}

function statusPanel(context) {
  const { mode, revision, task } = context;
  const feedback = mode.feedback?.feedback || String(revision?.system_content || '').trim();
  const pages = affectedPages(revision);
  const pageText = pages.length ? `P${pages.join('、P')}` : '待 AI 判断';
  const error = analysisErrors.get(task.id) || '';

  if (mode.kind === 'needs_analysis') {
    return `<div class="rounded-xl border border-blue-500/25 bg-blue-950/20 p-5">
      <div class="flex items-center gap-3"><div class="spin"></div><div><p class="text-sm font-bold text-blue-200">AI 设计师正在理解需求方修改意见</p><p class="text-xs text-slate-400 mt-1">这里只做内容理解和受影响页面判断，不会创建任何图片生成任务。</p></div></div>
      ${error ? `<div class="mt-4 rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs text-rose-200">理解失败：${esc(error)}<br><button data-ai-revision-action="reanalyze" class="btn bg-slate-700 text-white mt-3">重新理解修改意见</button></div>` : ''}
    </div>`;
  }
  if (mode.kind === 'ready_to_generate') {
    return `<div class="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-5">
      <p class="text-sm font-bold text-emerald-300">修改意见已理解完成 · 尚未生图</p>
      <p class="text-xs text-slate-400 mt-2">AI 判断本轮仅需修改：<span class="text-white font-bold">${esc(pageText)}</span>。未受影响页面继续复用领导已通过的母版。</p>
      <button data-ai-revision-action="generate" data-revision-id="${esc(revision?.id || '')}" class="btn bg-violet-600 hover:bg-violet-500 text-white mt-4">AI 设计师生成 ${esc(pageText)} 修改页</button>
      <p class="text-[11px] text-slate-500 mt-2">此按钮仅 AI 设计师账号可执行；点击后才会创建 Seedream generation。</p>
    </div>`;
  }
  if (mode.kind === 'generating') {
    return `<div class="rounded-xl border border-violet-500/25 bg-violet-950/15 p-5"><div class="flex items-center gap-3"><div class="spin"></div><div><p class="text-sm font-bold text-violet-200">正在修改 ${esc(pageText)}</p><p class="text-xs text-slate-400 mt-1">严格沿用领导已通过母版，完成后直接回需求方验收，不再经过领导。</p></div></div></div>`;
  }
  if (mode.kind === 'requester_review') {
    return `<div class="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-5"><p class="text-sm font-bold text-emerald-300">修改版已完成，等待需求方验收</p><p class="text-xs text-slate-400 mt-2">本轮只修改 ${esc(pageText)}，流程不会再次进入领导审核。</p></div>`;
  }
  if (mode.kind === 'capacity_conflict') {
    return `<div class="rounded-xl border border-amber-500/25 bg-amber-950/15 p-5"><p class="text-sm font-bold text-amber-300">内容超出已通过母版容量</p><p class="text-xs text-slate-400 mt-2">AI 不能自行推倒框架。请让需求方精简或调整内容后再提交。</p></div>`;
  }
  if (mode.kind === 'failed') {
    return `<div class="rounded-xl border border-rose-500/25 bg-rose-950/15 p-5"><p class="text-sm font-bold text-rose-300">本轮内容修改生成失败</p><p class="text-xs text-slate-400 mt-2">母版和上一版仍保留，不会退回领导审核。</p></div>`;
  }
  return `<div class="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><p class="text-sm text-slate-300">母版已锁定，等待需求方提交新的内容修改意见。</p></div>`;
}

function renderLockedMode(context) {
  const detail = document.getElementById('detail');
  if (!detail || !context.template) return;
  const { task, template, mode, revision } = context;
  const feedback = mode.feedback?.feedback || String(revision?.system_content || '').trim() || '暂无新的需求方修改意见';
  const pages = affectedPages(revision);
  const key = JSON.stringify({ task: task.id, status: task.status, template: template.id, revision: revision?.id || '', revisionStatus: revision?.status || '', pages, feedback, error: analysisErrors.get(task.id) || '' });
  if (key === lastRenderKey && detail.dataset.aiContentRevisionMode === 'v1') return;
  lastRenderKey = key;
  detail.dataset.aiContentRevisionMode = 'v1';
  paintPipeline(mode);
  detail.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
      <div><p class="text-xs font-mono text-blue-400">${esc(task.id)}</p><h2 class="text-2xl font-bold text-white mt-2">${esc(task.title || '')}</h2><p class="text-sm text-slate-400 mt-2">已进入已通过母版的内容修改模式</p></div>
      <span class="px-3 py-1.5 rounded-full bg-emerald-950 text-emerald-300 text-xs">母版已锁定</span>
    </div>
    <div class="grid xl:grid-cols-[1fr_420px] gap-6 mt-6">
      <div class="space-y-5">
        <div class="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5"><p class="text-sm font-bold text-emerald-300">领导审核已完成，不再回到框架审批</p><p class="text-xs text-slate-400 mt-2">母版 ${esc(template.framework_version || '')} 已冻结。后续只允许基于母版修改内容和受影响页面。</p></div>
        <div class="rounded-xl border border-blue-500/25 bg-blue-950/15 p-5"><p class="text-xs text-blue-300 font-bold tracking-wide">需求方最新修改意见</p><p class="text-base text-white leading-7 mt-3 whitespace-pre-wrap">${esc(feedback)}</p>${mode.feedback?.refresh_tencent_doc ? '<p class="text-xs text-cyan-300 mt-3">需求方同时标记：腾讯文档已更新，需要读取最新内容。</p>' : ''}</div>
        ${statusPanel(context)}
      </div>
      <div class="space-y-5">
        <div class="rounded-xl bg-slate-950 border border-white/10 p-5"><p class="text-sm font-bold text-white">本轮执行边界</p><ul class="text-xs text-slate-400 mt-3 space-y-2"><li>• 不允许更换或重做领导已通过的设计框架</li><li>• 只修改 AI 判断受影响的页面</li><li>• 只有 AI 设计师能够触发生图</li><li>• 修改完成后直接回需求方验收</li></ul></div>
        <div class="rounded-xl bg-slate-950 border border-white/10 p-5"><p class="text-sm font-bold text-white">当前受影响页</p><p class="text-2xl font-bold text-violet-300 mt-3">${pages.length ? `P${pages.join(' · P')}` : 'AI 判断中'}</p></div>
      </div>
    </div>`;
}

async function analyzeIfNeeded(context) {
  if (context.mode.kind !== 'needs_analysis' || !context.mode.feedback?.feedback || busy) return;
  const taskId = context.task.id;
  const feedbackKey = `${context.mode.feedback.time}:${context.mode.feedback.feedback}`;
  if (analysisAttempts.get(taskId) === feedbackKey) return;
  analysisAttempts.set(taskId, feedbackKey);
  analysisErrors.delete(taskId);
  busy = true;
  try {
    const refresh = Boolean(context.mode.feedback.refresh_tencent_doc);
    await prepareContentRevision(sb, taskId, {
      source_mode: refresh ? 'combined' : 'system_text',
      system_content: context.mode.feedback.feedback,
      requester_feedback: context.mode.feedback.feedback,
      use_tencent_doc: refresh,
      refresh_tencent_doc: refresh,
    });
  } catch (error) {
    analysisErrors.set(taskId, error instanceof Error ? error.message : String(error));
  } finally {
    busy = false;
    await sync(true);
  }
}

async function sync(force = false) {
  if (!sb) return;
  const taskId = selectedTaskId();
  if (!taskId) return;
  try {
    const context = await loadContext(taskId);
    if (!context.template) return;
    if (force) lastRenderKey = '';
    renderLockedMode(context);
    await analyzeIfNeeded(context);
  } catch (error) {
    console.error('AI 内容修改模式同步失败:', error);
  }
}

async function handleAction(button) {
  const action = String(button.dataset.aiRevisionAction || '');
  const taskId = selectedTaskId();
  if (!taskId || busy) return;
  if (action === 'reanalyze') {
    analysisAttempts.delete(taskId);
    analysisErrors.delete(taskId);
    return sync(true);
  }
  if (action === 'generate') {
    const revisionId = String(button.dataset.revisionId || '').trim();
    if (!revisionId) return;
    if (!confirm('确认由 AI 设计师生成本轮受影响页面？只有此操作才会创建图片生成任务。')) return;
    busy = true;
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = '正在创建修改页生成任务…';
    try {
      await generateContentRevision(sb, taskId, revisionId);
    } catch (error) {
      alert(`生成任务创建失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
      if (button.isConnected) { button.disabled = false; button.textContent = oldText; }
      await sync(true);
    }
  }
}

export function bootstrapAiDesignerContentRevisionModeV1(client) {
  if ((location.pathname.split('/').pop() || '') !== 'ai-designer-workspace.html') return;
  if (window.__aiDesignerContentRevisionModeV1) return;
  window.__aiDesignerContentRevisionModeV1 = true;
  sb = client;
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-ai-revision-action]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleAction(button);
  }, true);
  timer = setInterval(() => sync(false), 800);
  setTimeout(() => sync(true), 300);
  window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });
}
