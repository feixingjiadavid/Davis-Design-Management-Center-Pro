import { activeRevision, feedbackCoveredByRevision, latestRequesterFeedback, nextRevisionNo, parseHistory, revisionStage } from './revision-cycle-core.mjs?v=revision-loop-v1';
import { buildRequesterRevisionRequest, isRequesterUser } from './requester-framework-revision-core.mjs?v=requester-template-revision-v5';

let sb = null;
let taskId = '';
let state = null;
let timer = null;
let observer = null;
let busy = false;
let editorOpen = false;
let restoring = false;
let lastKey = '';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const api = () => window.aiRequirementClient;
const toast = (title, message, kind = 'success') => window.showToast ? window.showToast(title, message, kind) : console.log(title, message);
const currentUser = () => { try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); } catch { return {}; } };
const panel = () => document.getElementById('smart-action-panel');

async function load() {
  const [taskResult, templateResult, revisionsResult, analysesResult, clarificationsResult] = await Promise.all([
    sb.from('test_tasks').select('*').eq('id', taskId).single(),
    sb.from('uat_framework_templates').select('*').eq('task_id', taskId).maybeSingle(),
    sb.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending:false }),
    sb.from('uat_requirement_analyses').select('*').eq('task_id', taskId).order('version', { ascending:false }).limit(1),
    sb.from('uat_clarifications').select('*').eq('task_id', taskId).order('created_at', { ascending:true }),
  ]);
  const error = taskResult.error || templateResult.error || revisionsResult.error || analysesResult.error || clarificationsResult.error;
  if (error) throw error;
  const task = taskResult.data;
  const template = templateResult.data || null;
  const revisions = revisionsResult.data || [];
  const history = parseHistory(task.history_json);
  const analysis = (analysesResult.data || [])[0] || null;
  const clarifications = (clarificationsResult.data || []).filter((item) => String(item.analysis_id || '') === String(analysis?.id || ''));
  const openClarifications = clarifications.filter((item) => String(item.status || '') === 'open');
  return { task, template, revisions, history, latest:activeRevision(revisions), feedback:latestRequesterFeedback(history), analysis, clarifications, openClarifications };
}

function pagesText(revision) {
  const pages = (revision?.affected_pages || []).map(Number).filter(Boolean).sort((a,b)=>a-b);
  return pages.length ? `P${pages.join('、P')}` : 'AI 判断中';
}
function pendingRoundNo() { return nextRevisionNo(state?.revisions || []); }

function cycleHistoryHtml(revisions, feedback) {
  const items = [...revisions].sort((a,b)=>Number(a.revision_no||0)-Number(b.revision_no||0));
  const pending = feedback && !feedbackCoveredByRevision(feedback, activeRevision(revisions));
  if (!items.length && !pending) return '';
  const rows = items.map((revision) => {
    const stage = revisionStage(revision.status);
    const text = String(revision.system_content || revision.change_summary?.requester_feedback || '').trim();
    return `<div class="rounded-xl border border-white/10 bg-black/20 p-3"><div class="flex items-center justify-between gap-3"><span class="text-[11px] font-bold text-indigo-200">第 ${Number(revision.revision_no||0)} 次修改</span><span class="text-[10px] text-zinc-400">${esc(stage.label)}</span></div><p class="text-[10px] text-zinc-500 mt-1">影响页：${esc(pagesText(revision))}</p>${text ? `<p class="text-[11px] text-zinc-300 mt-2 leading-relaxed">${esc(text)}</p>` : ''}</div>`;
  });
  if (pending) rows.push(`<div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><div class="flex items-center justify-between gap-3"><span class="text-[11px] font-bold text-blue-200">第 ${nextRevisionNo(revisions)} 次修改</span><span class="text-[10px] text-blue-300">${state?.openClarifications?.length ? 'AI 理解后等待补充' : 'AI 正在真实理解'}</span></div><p class="text-[11px] text-zinc-300 mt-2 leading-relaxed">${esc(feedback.feedback)}</p></div>`);
  return `<div class="mt-5 pt-5 border-t border-white/10"><div class="flex items-center justify-between"><p class="text-[11px] font-bold text-white">内容修改循环记录</p><span class="text-[10px] text-zinc-500">${items.length} 个已建轮次${pending ? ' + 1 个处理中' : ''}</span></div><div class="mt-3 space-y-2">${rows.join('')}</div></div>`;
}

function editor() {
  return `<div class="mt-5 pt-5 border-t border-white/10 space-y-4"><div><p class="text-[12px] font-bold text-white">继续补充修改意见</p><p class="text-[11px] text-zinc-500 mt-1 leading-relaxed">只需要告诉 AI 设计师要调整什么。AI 会真实理解、判断受影响页面；需要重新生图时由 AI 设计师自动执行，完成后再次交付给你验收。</p></div><textarea id="revision-loop-feedback" class="w-full h-28 bg-[#09090b] border border-zinc-700 rounded-xl px-3 py-3 text-[12px] text-white resize-none focus:border-indigo-500 outline-none" placeholder="例如：P2 文字仍有乱码；P3 金额改为 8000 元豆。"></textarea><label class="flex gap-2 items-center text-[11px] text-zinc-400"><input id="revision-loop-refresh-tencent" type="checkbox" class="accent-indigo-500"> 我已更新腾讯文档，请 AI 设计师同时读取最新内容</label><button data-revision-loop-action="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-bold">提交修改意见给 AI 设计师</button></div>`;
}

function clarificationHtml() {
  const questions = state?.openClarifications || [];
  if (!questions.length) return '';
  const analysis = state.analysis || {};
  return `<div class="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"><div class="flex items-start justify-between gap-3"><div><p class="text-[13px] font-bold text-amber-300">第 ${pendingRoundNo()} 次修改 · AI 需要你补充信息</p><p class="text-[10px] text-zinc-500 mt-1">这是 DeepSeek analysis v${analysis.version || '-'} 的真实判断，不是固定问题。</p></div><span class="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-300">${questions.length} 个问题</span></div><div class="mt-4 space-y-4">${questions.map((item,index)=>`<div><p class="text-[11px] text-zinc-200 leading-relaxed">${index+1}. ${esc(item.question)}</p><textarea data-revision-clarification="${esc(item.id)}" class="mt-2 w-full min-h-[76px] bg-[#09090b] border border-amber-500/20 rounded-xl px-3 py-2.5 text-[12px] text-white resize-none outline-none focus:border-amber-400" placeholder="请补充明确答案"></textarea></div>`).join('')}<textarea id="revision-clarification-message" class="w-full min-h-[60px] bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white resize-none outline-none" placeholder="其他补充说明（选填）"></textarea><button data-revision-loop-action="answer-clarifications" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[12px] font-bold">提交补充，继续让 AI 理解</button></div></div>`;
}

function statusBlock() {
  const { latest, feedback, openClarifications } = state;
  if (openClarifications?.length) return clarificationHtml();
  if (!latest) {
    if (feedback) return `<div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"><p class="text-[13px] font-bold text-blue-300">第 ${pendingRoundNo()} 次修改 · AI 设计师已收到意见</p><p class="text-[11px] text-zinc-400 mt-2 leading-relaxed">${esc(feedback.feedback)}</p><p class="text-[10px] text-zinc-500 mt-2">AI 正在进行真实需求理解；需要修改图片时会由 AI 设计师自动执行。</p></div>`;
    return `<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p class="text-[13px] font-bold text-emerald-300">领导已通过设计母版</p><p class="text-[11px] text-zinc-400 mt-2">当前母版可直接验收；如果还有内容要调整，可继续补充修改意见。</p></div>`;
  }
  const stage = revisionStage(latest.status);
  if (['generation_requested','generating'].includes(String(latest.status))) return `<div class="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><p class="text-[13px] font-bold text-violet-300">第 ${latest.revision_no} 次修改生成中</p><p class="text-[11px] text-zinc-400 mt-2">AI 已完成理解，正在基于已锁母版修改 ${esc(pagesText(latest))}。完成后会自动回到这里等待你验收。</p></div>`;
  if (String(latest.status) === 'content_ready') return `<div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"><p class="text-[13px] font-bold text-blue-300">第 ${latest.revision_no} 次修改已理解</p><p class="text-[11px] text-zinc-400 mt-2">AI 判断需要修改 ${esc(pagesText(latest))}，正在由 AI 设计师继续执行生成。</p></div>`;
  if (String(latest.status) === 'ready_for_review') return `<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p class="text-[13px] font-bold text-emerald-300">第 ${latest.revision_no} 次修改已交付 · 待您验收</p><p class="text-[11px] text-zinc-400 mt-2">本轮更新 ${esc(pagesText(latest))}。满意即可验收结束；仍需调整则继续提交下一轮修改意见。</p></div>`;
  if (String(latest.status) === 'capacity_conflict') return `<div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p class="text-[13px] font-bold text-amber-300">第 ${latest.revision_no} 次修改存在容量冲突</p><p class="text-[11px] text-zinc-400 mt-2">AI 不会推倒领导已通过母版，请精简或重新组织内容后继续提交。</p></div>`;
  if (String(latest.status) === 'failed') return `<div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><p class="text-[13px] font-bold text-rose-300">第 ${latest.revision_no} 次修改生成失败</p><p class="text-[11px] text-zinc-400 mt-2">上一可验收版本仍保留，可继续补充意见让 AI 重新处理。</p></div>`;
  return `<div class="rounded-xl border border-white/10 bg-white/5 p-4"><p class="text-[13px] font-bold text-white">第 ${latest.revision_no} 次修改 · ${esc(stage.label)}</p></div>`;
}

function canAccept() {
  if (!state?.template || state.openClarifications?.length) return false;
  if (!state.latest) return String(state.task.status) === 'reviewing' && !state.feedback;
  return String(state.latest.status) === 'ready_for_review';
}
function canEdit() {
  if (!state?.template || state.openClarifications?.length) return false;
  if (!state.latest) return !state.feedback;
  return ['ready_for_review','capacity_conflict','failed','superseded'].includes(String(state.latest.status));
}

function render() {
  const host = panel();
  if (!host || !state?.template || !isRequesterUser(currentUser())) return;
  restoring = true;
  host.dataset.requesterRevisionLoop = 'v1';
  host.className = 'bg-[#121217] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
  const actions = `${canAccept() ? '<button data-revision-loop-action="accept" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[13px] font-bold">满意，确认验收并结束</button>' : ''}${canEdit() ? '<button data-revision-loop-action="toggle" class="w-full py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl text-[12px] font-bold">继续补充修改意见</button>' : ''}`;
  host.innerHTML = `<div data-revision-loop-root="v1"><div class="flex items-center justify-between gap-3"><div><h3 class="text-[16px] font-bold text-white">已锁母版 · 内容修改循环</h3><p class="text-[11px] text-zinc-500 mt-1">领导审核结果永久保留；后续只在母版内循环“修改 → AI理解/生成 → 需求方验收”。</p></div><span class="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">母版已锁定</span></div><div class="mt-5">${statusBlock()}</div>${actions ? `<div class="mt-4 space-y-3">${actions}</div>` : ''}${editorOpen && canEdit() ? editor() : ''}${cycleHistoryHtml(state.revisions,state.feedback)}</div>`;
  syncHeader();
  queueMicrotask(() => { restoring = false; });
}

function syncHeader() {
  const badge = document.getElementById('header-status-badge');
  if (!badge || !state?.template) return;
  let text = '母版已锁定';
  if (state.openClarifications?.length) text = `第 ${pendingRoundNo()} 次修改待补充`;
  else if (state.latest?.status === 'ready_for_review') text = `第 ${state.latest.revision_no} 次修改待验收`;
  else if (['generation_requested','generating'].includes(String(state.latest?.status))) text = `第 ${state.latest.revision_no} 次修改生成中`;
  else if (state.feedback && !state.latest) text = `第 ${pendingRoundNo()} 次修改 AI 理解中`;
  badge.textContent = text;
  badge.className = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5';
  badge.classList.remove('hidden');
}

function keyOf(next) {
  return JSON.stringify({ status:next.task.status, summary:next.task.summary_desc, template:next.template?.id || '', revisions:next.revisions.map(r=>[r.id,r.revision_no,r.status,r.affected_pages,r.system_content,r.generated_at]), feedback:next.feedback?.feedback || '', analysis:[next.analysis?.id,next.analysis?.version,next.analysis?.status], clarifications:next.openClarifications.map(q=>[q.id,q.question,q.status]), editorOpen });
}

async function sync(force = false) {
  if (!sb || !taskId || busy) return;
  busy = true;
  try {
    const next = await load();
    if (next.task?.assignee !== 'davis.design.ai') return;
    state = next;
    const key = keyOf(next);
    const ownershipLost = !panel()?.querySelector('[data-revision-loop-root="v1"]');
    if (force || key !== lastKey || ownershipLost) { lastKey = key; render(); }
  } catch (error) {
    console.error('需求方 revision 循环同步失败:', error);
  } finally { busy = false; }
}

async function handleAction(button) {
  const action = String(button.dataset.revisionLoopAction || '');
  if (action === 'toggle') { editorOpen = !editorOpen; render(); return; }
  if (action === 'accept') {
    if (!confirm('确认当前版本满意并结束整个需求？验收后流程完结。')) return;
    button.disabled = true;
    await api().acceptCurrentRevision(sb, taskId);
    toast('验收完成', '当前版本已确认，整个需求正式结束。', 'success');
    location.reload();
    return;
  }
  if (action === 'answer-clarifications') {
    const fields = [...document.querySelectorAll('[data-revision-clarification]')];
    const answers = fields.map((field) => ({ clarification_id:String(field.dataset.revisionClarification || ''), answer:String(field.value || '').trim() })).filter((item) => item.answer);
    if (!answers.length) return toast('请先回答问题', '至少填写一个 AI 提出的关键问题。', 'info');
    if (answers.length !== fields.length) return toast('还有问题未回答', '本轮关键问题需要全部回答后，AI 才能继续判断。', 'info');
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'AI 正在结合补充继续理解…';
    try {
      const result = await api().invokeAiAction(sb, taskId, 'answer_content_revision_clarification', { answers, message:String(document.getElementById('revision-clarification-message')?.value || '').trim(), client_request_id:crypto.randomUUID() });
      if (result.status === 'processing') toast('AI 已继续处理', '补充信息已进入同一轮修改；需要生图时将由 AI 设计师自动生成。', 'success');
      else if (result.status === 'needs_input') toast('AI 还有关键问题', 'AI 已重新理解，但仍需要进一步补充。', 'info');
      else if (result.status === 'capacity_conflict') toast('内容容量冲突', '请根据 AI 判断精简或调整内容。', 'error');
      else toast('AI 已完成本轮理解', '正在同步本轮处理结果。', 'success');
      await sync(true);
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = old; } }
    return;
  }
  if (action === 'submit') {
    let payload;
    try { payload = buildRequesterRevisionRequest(String(document.getElementById('revision-loop-feedback')?.value || ''), Boolean(document.getElementById('revision-loop-refresh-tencent')?.checked)); }
    catch { return toast('请填写修改意见', '请告诉 AI 设计师这一轮具体要调整什么。', 'error'); }
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'AI 正在理解并处理…';
    try {
      const result = await api().submitContentRevisionRequest(sb, taskId, payload);
      editorOpen = false;
      if (result.status === 'processing') toast('AI 已开始处理', '已完成需求理解并进入需要修改页面的生成流程。', 'success');
      else if (result.status === 'needs_input') toast('AI 需要补充信息', 'AI 的真实问题会直接显示在这里，请回答后继续本轮修改。', 'info');
      else if (result.status === 'capacity_conflict') toast('内容容量冲突', '请精简或重新组织内容后继续提交。', 'error');
      else if (result.status === 'no_change') toast('AI 已完成判断', '本轮无需重新生图，可直接验收当前版本。', 'success');
      else toast('修改意见已提交', 'AI 设计师正在继续处理。', 'info');
      await sync(true);
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = old; } }
  }
}

function install() {
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('[data-revision-loop-action]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled) return;
    try { await handleAction(button); }
    catch (error) { toast('操作失败', error instanceof Error ? error.message : String(error), 'error'); }
  }, true);
  const host = panel();
  if (host) {
    observer = new MutationObserver(() => {
      if (restoring || !state?.template) return;
      if (!host.querySelector('[data-revision-loop-root="v1"]')) render();
    });
    observer.observe(host, { childList:true, subtree:false });
  }
}

export function bootstrapRequesterRevisionLoopV1(client) {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html' || window.__requesterRevisionLoopV1) return;
  window.__requesterRevisionLoopV1 = true;
  sb = client;
  taskId = String(new URLSearchParams(location.search).get('id') || '').trim();
  const start = () => { install(); sync(true); timer = setInterval(() => sync(false), 2500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
  window.addEventListener('beforeunload', () => { clearInterval(timer); observer?.disconnect(); }, { once:true });
}
