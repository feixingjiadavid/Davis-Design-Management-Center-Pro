import { buildRequesterRevisionRequest, isRequesterUser, selectRequesterFlowState } from './requester-framework-revision-core.mjs?v=requester-template-revision-v5';

let sb = null;
let taskId = '';
let state = null;
let timer = null;
let lastDbKey = '';
let editorOpen = false;
let busy = false;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const user = () => { try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); } catch { return {}; } };
const parseHistory = (raw) => { if (Array.isArray(raw)) return raw; try { const value = JSON.parse(String(raw || '[]')); return Array.isArray(value) ? value : []; } catch { return []; } };
const panel = () => document.getElementById('smart-action-panel');
const api = () => window.aiRequirementClient;
const toast = (title, message, kind = 'success') => window.showToast ? window.showToast(title, message, kind) : console.log(title, message);

function latestRequesterFeedback(history = []) {
  const accepted = new Set(['requester_revision_feedback', 'reject_draft']);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index] || {};
    if (!accepted.has(String(item.action || ''))) continue;
    const feedback = String(item.reply || item.requester_feedback || '').trim();
    if (feedback) return { feedback, item };
  }
  return { feedback:'', item:null };
}

async function load() {
  const [taskResult, templateResult, revisionsResult] = await Promise.all([
    sb.from('test_tasks').select('*').eq('id', taskId).single(),
    sb.from('uat_framework_templates').select('*').eq('task_id', taskId).maybeSingle(),
    sb.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending:false }),
  ]);
  if (taskResult.error) throw taskResult.error;
  if (templateResult.error) throw templateResult.error;
  if (revisionsResult.error) throw revisionsResult.error;
  const task = taskResult.data;
  const template = templateResult.data || null;
  const revisions = revisionsResult.data || [];
  const history = parseHistory(task.history_json);
  return { task, template, revisions, history, flow:selectRequesterFlowState({ task, template, revisions, history }) };
}

function dbKey(next) {
  const latestFeedback = latestRequesterFeedback(next.history);
  return JSON.stringify({
    status:next.task.status,
    summary:next.task.summary_desc,
    template:next.template?.id || '',
    revision:next.flow.latest?.id || '',
    revisionStatus:next.flow.latest?.status || '',
    feedback:latestFeedback.feedback,
    editorOpen,
  });
}

function syncHeader(kind) {
  const badge = document.getElementById('header-status-badge');
  if (!badge) return;
  if (kind === 'content_revision_requested') badge.textContent = '母版已通过 · 修改意见已提交';
  else if (kind === 'content_revision_waiting_ai') badge.textContent = 'AI 已理解 · 等待设计师执行';
  else if (kind === 'content_revision_generating') badge.textContent = 'AI 设计师修改中';
  else if (kind === 'content_revision_review') badge.textContent = '修改版待需求方验收';
  else if (kind === 'template_review') badge.textContent = '领导已通过 · 待需求方验收';
  else return;
  badge.className = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5';
  badge.classList.remove('hidden');
}

function editor(initialFeedback = '') {
  return `<div class="mt-5 pt-5 border-t border-white/10 space-y-4">
    <div><p class="text-[12px] font-bold text-white">补充本轮修改信息</p><p class="text-[11px] text-zinc-500 mt-1 leading-relaxed">需求方只负责补充需求信息。提交后由 AI 设计师理解并决定如何修改；需求方不会触发任何图片生成。</p></div>
    <textarea id="template-revision-feedback" class="w-full h-32 bg-[#09090b] border border-zinc-700 rounded-xl px-3 py-3 text-[12px] text-white resize-none focus:border-indigo-500 outline-none" placeholder="例如：P2 出现文字乱码，需要纠正；P3 奖励金额改成 8000 元豆。">${esc(initialFeedback)}</textarea>
    <label class="flex gap-2 items-center text-[11px] text-zinc-400"><input id="template-refresh-tencent" type="checkbox" class="accent-indigo-500"> 我已更新腾讯文档，请 AI 设计师同时读取最新内容</label>
    <button data-template-action="submit-revision" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-bold transition-colors">提交补充信息给 AI 设计师</button>
    <p class="text-[10px] text-zinc-500 leading-relaxed text-center">此操作只提交信息和触发 AI 理解，不会创建 Seedream generation。</p>
  </div>`;
}

function requestedHtml() {
  const { feedback } = latestRequesterFeedback(state.history);
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
    <h3 class="text-[16px] font-bold text-indigo-300">修改意见已提交给 AI 设计师</h3>
    <p class="text-[12px] text-zinc-400 leading-relaxed mt-2">领导已通过的设计母版继续锁定。需求方只补充内容，不会重新生成框架，也没有生图权限。</p>
    ${feedback ? `<div class="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3"><p class="text-[10px] text-zinc-500">当前修改意见</p><p class="text-[12px] text-indigo-200 mt-1 leading-relaxed">${esc(feedback)}</p></div>` : ''}
    <button data-template-action="toggle-editor" class="w-full mt-4 py-3 bg-white/5 border border-white/10 text-zinc-300 rounded-xl text-[12px] font-bold">继续补充信息</button>
    ${editorOpen ? editor('') : ''}`;
}

function waitingAiHtml() {
  const revision = state.flow.latest;
  const pages = (revision?.affected_pages || []).map(Number).filter(Boolean);
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
    <h3 class="text-[16px] font-bold text-blue-300">AI 已理解修改意见</h3>
    <p class="text-[12px] text-zinc-400 leading-relaxed mt-2">AI 已完成内容理解和受影响页面判断，当前尚未生图。下一步只能由 AI 设计师执行修改。</p>
    <div class="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><p class="text-[10px] text-zinc-500">AI 判断需要修改</p><p class="text-[14px] font-bold text-blue-200 mt-1">${pages.length ? `P${pages.join('、P')}` : '等待 AI 设计师确认'}</p></div>
    <p class="text-[10px] text-zinc-500 mt-3 text-center">需求方无需操作，也无法触发图片生成。</p>`;
}

function generatingHtml() {
  const pages = (state.flow.latest?.affected_pages || []).map(Number).filter(Boolean);
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-violet-500"></div>
    <h3 class="text-[16px] font-bold text-violet-300">AI 设计师正在执行内容修改</h3>
    <p class="text-[12px] text-zinc-400 mt-2 leading-relaxed">正在基于领导已通过母版处理${pages.length ? ` P${pages.join('、P')}` : '受影响页面'}。未受影响页面继续复用原版本。</p>
    <div class="mt-4 flex items-center gap-2 text-[11px] text-violet-300"><span class="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span> 完成后直接回到需求方验收，不再送领导审核</div>`;
}

function reviewHtml(revision = false) {
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
    <h3 class="text-[16px] font-bold text-emerald-400">${revision ? `内容修改版 r${state.flow.latest?.revision_no || ''} 待您验收` : '领导已通过设计母版 · 待您验收'}</h3>
    <p class="text-[12px] text-zinc-400 leading-relaxed mt-2 mb-5">${revision ? '当前版本只执行了本轮内容修改；验收后直接完结，不再经过领导。' : '内容无误可直接验收；如需调整，只能补充修改信息给 AI 设计师。'}</p>
    <div class="space-y-3"><button data-template-action="accept" class="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-[13px] font-bold">确认验收并完结</button><button data-template-action="toggle-editor" class="w-full py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl text-[12px] font-bold">补充修改信息</button></div>
    ${editorOpen ? editor('') : ''}`;
}

function capacityHtml() {
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
    <h3 class="text-[16px] font-bold text-amber-300">AI 判断内容超出母版容量</h3>
    <p class="text-[12px] text-zinc-400 mt-2">AI 不会擅自推倒领导已通过的框架。请精简或调整内容后重新补充信息。</p>
    ${editor('')}`;
}

function rejectedFrameworkHtml() {
  const feedback = [...state.history].reverse().find((item) => item?.action === 'reject_framework')?.reply || '领导认为当前方向不合适。';
  return `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500"></div><h3 class="text-[16px] font-bold text-rose-300">框架尚未通过</h3><p class="text-[12px] text-zinc-400 mt-2">领导意见：${esc(feedback)}</p><p class="text-[11px] text-zinc-500 mt-3">需求方只能补充调整信息；重新生图必须由 AI 设计师执行。</p>`;
}

function render() {
  const host = panel();
  if (!host || !state || !isRequesterUser(user())) return;
  const kind = state.flow.kind;
  const supported = new Set(['framework_rejected_waiting_requester','content_revision_requested','content_revision_waiting_ai','template_review','content_revision_review','content_revision_generating','capacity_conflict']);
  if (!supported.has(kind)) return;
  syncHeader(kind);
  host.className = 'bg-[#121217] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
  host.dataset.templateWorkflow = 'v5';
  if (kind === 'framework_rejected_waiting_requester') host.innerHTML = rejectedFrameworkHtml();
  else if (kind === 'content_revision_requested') host.innerHTML = requestedHtml();
  else if (kind === 'content_revision_waiting_ai') host.innerHTML = waitingAiHtml();
  else if (kind === 'content_revision_generating') host.innerHTML = generatingHtml();
  else if (kind === 'capacity_conflict') host.innerHTML = capacityHtml();
  else host.innerHTML = reviewHtml(kind === 'content_revision_review');
}

async function sync(force = false) {
  if (busy || !sb || !taskId) return;
  busy = true;
  try {
    const next = await load();
    if (next.task?.assignee !== 'davis.design.ai') return;
    state = next;
    const key = dbKey(next);
    if (force || key !== lastDbKey) {
      lastDbKey = key;
      render();
    }
  } catch (error) {
    console.error('需求方内容修改流程同步失败', error);
  } finally {
    busy = false;
  }
}

async function act(name, target) {
  if (!state) return;
  if (name === 'toggle-editor') {
    editorOpen = !editorOpen;
    lastDbKey = '';
    render();
    return;
  }
  if (name === 'accept') {
    if (!confirm('确认以当前版本作为最终交付并完结？此操作不会再次生图。')) return;
    await api().acceptCurrentRevision(sb, taskId);
    toast('验收完成', '当前版本已完结。', 'success');
    return location.reload();
  }
  if (name === 'submit-revision') {
    let payload;
    try {
      payload = buildRequesterRevisionRequest(String(document.getElementById('template-revision-feedback')?.value || ''), Boolean(document.getElementById('template-refresh-tencent')?.checked));
    } catch {
      return toast('请填写修改信息', '需要先告诉 AI 设计师具体要调整什么。', 'error');
    }
    const oldText = target.textContent;
    target.textContent = '正在提交给 AI 设计师理解…';
    const result = await api().submitContentRevisionRequest(sb, taskId, payload);
    if (result.status === 'content_ready') {
      editorOpen = false;
      toast('AI 已理解修改信息', '已判断受影响页面，等待 AI 设计师执行修改；没有触发生图。', 'success');
    } else if (result.status === 'capacity_conflict') {
      toast('内容容量冲突', 'AI 判断新内容超出母版承载范围，请调整后重新提交。', 'error');
    } else if (result.status === 'needs_input') {
      toast('AI 需要补充信息', '请回答 AI 提出的关键问题。', 'info');
    } else if (result.status === 'no_change') {
      toast('无需修改', 'AI 判断当前版本无需重新生成。', 'success');
    } else {
      toast('信息已提交', 'AI 设计师正在继续理解，本次没有触发生图。', 'info');
    }
    if (target.isConnected) target.textContent = oldText;
    return sync(true);
  }
}

function installClickHandler() {
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-template-action]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    button.disabled = true;
    try {
      await act(String(button.dataset.templateAction || ''), button);
    } catch (error) {
      toast('操作失败', error?.message || String(error), 'error');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }, true);
}

export function bootstrapRequesterFrameworkRevisionFlowV3(client) {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html' || window.__requesterFrameworkRevisionV3) return;
  window.__requesterFrameworkRevisionV3 = true;
  sb = client;
  taskId = String(new URLSearchParams(location.search).get('id') || '').trim();
  const start = () => {
    installClickHandler();
    sync(true);
    timer = setInterval(() => sync(false), 3500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
  window.addEventListener('beforeunload', () => clearInterval(timer), { once:true });
}
