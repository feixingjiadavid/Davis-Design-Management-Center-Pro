import { isLeaderUser, isRequesterUser, selectRequesterFlowState } from './requester-framework-revision-core.mjs?v=requester-template-revision-v1';

let sb = null;
let id = '';
let syncing = false;
let timer = null;
let observer = null;
let lastSnapshot = '';
let panelOpen = false;
let lastCheck = null;
let preparedRevision = null;
let painting = false;
let originalSubmitApprove = null;
let originalSubmitReject = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const parseHistory = raw => { if (Array.isArray(raw)) return raw; try { const v = JSON.parse(String(raw || '[]')); return Array.isArray(v) ? v : []; } catch { return []; } };
const currentTaskId = () => String(new URLSearchParams(location.search).get('id') || '').trim();
const currentUser = () => { try { return JSON.parse(localStorage.getItem('activeUserObj') || '{}'); } catch { return {}; } };
const client = () => window.aiRequirementClient;

async function loadState() {
  const [taskResult, templateResult, revisionsResult] = await Promise.all([
    sb.from('test_tasks').select('*').eq('id', id).single(),
    sb.from('uat_framework_templates').select('*').eq('task_id', id).maybeSingle(),
    sb.from('uat_content_revisions').select('*').eq('task_id', id).order('revision_no', { ascending: false }),
  ]);
  if (taskResult.error) throw taskResult.error;
  if (templateResult.error) throw templateResult.error;
  if (revisionsResult.error) throw revisionsResult.error;
  const task = taskResult.data;
  const template = templateResult.data || null;
  const revisions = revisionsResult.data || [];
  const history = parseHistory(task?.history_json);
  return { task, template, revisions, history, flow: selectRequesterFlowState({ task, template, revisions, history }) };
}

function notify(title, message, kind = 'success') {
  if (typeof window.showToast === 'function') window.showToast(title, message, kind);
  else console.log(title, message);
}

function actionPanel() { return document.getElementById('smart-action-panel'); }

function renderRejected(state) {
  const feedback = String(state.flow?.formal?.reply || '领导认为当前框架方向不合适，请先沟通确认具体调整方向。');
  return `
    <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
    <div class="mb-5">
      <div class="text-[11px] text-rose-400 font-bold mb-2">框架方案被领导驳回</div>
      <h3 class="text-[16px] font-bold text-white">等待需求方确认下一轮调整方向</h3>
      <p class="text-[12px] text-zinc-400 leading-relaxed mt-2">请先与领导沟通清楚，再把最终可执行的调整要求告诉 AI 设计师。领导驳回本身不会自动生图。</p>
    </div>
    <div class="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 mb-4">
      <p class="text-[10px] text-zinc-500 mb-1">领导原始意见</p>
      <p class="text-[12px] text-rose-300 leading-relaxed">${esc(feedback)}</p>
    </div>
    <label class="block text-[11px] font-bold text-zinc-300 mb-2">本轮框架调整要求 <span class="text-rose-400">*</span></label>
    <textarea id="framework-requester-direction" class="w-full h-28 bg-[#09090b] border border-zinc-700 rounded-xl px-3 py-3 text-[12px] text-white outline-none focus:border-indigo-500 resize-none" placeholder="填写你与领导沟通后确认的明确调整方向，例如：整体更简洁，主标题更突出，减少装饰元素……"></textarea>
    <label class="flex items-center gap-2 mt-4 text-[11px] text-zinc-400 cursor-pointer"><input id="framework-refresh-tencent" type="checkbox" class="accent-indigo-500"> 同时重新读取最新腾讯文档</label>
    <label class="block text-[11px] font-bold text-zinc-300 mt-4 mb-2">补充业务信息（可选）</label>
    <textarea id="framework-supplemental-content" class="w-full h-20 bg-[#09090b] border border-zinc-700 rounded-xl px-3 py-3 text-[12px] text-white outline-none focus:border-indigo-500 resize-none" placeholder="如果本轮还有新增内容，可在这里补充"></textarea>
    <button id="framework-revision-generate-btn" class="w-full mt-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-bold transition-all">提交调整要求，重新生成框架</button>
    <p class="text-[10px] text-zinc-500 mt-2 text-center">只有点击上方按钮才会创建新一轮 Seedream 生成任务。</p>`;
}

function contentEditor() {
  const check = lastCheck ? (lastCheck.changed
    ? `<div class="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">检测到腾讯文档内容变化</div>`
    : `<div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300">腾讯文档未检测到新变化</div>`) : '';
  const prepared = preparedRevision?.status === 'content_ready'
    ? `<div class="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4 mt-4"><p class="text-[12px] text-indigo-300 font-bold">已完成内容差异分析</p><p class="text-[11px] text-zinc-400 mt-1">需要重新生成：P${(preparedRevision.affected_pages || []).join('、P')}</p><button id="content-revision-generate-btn" data-revision-id="${esc(preparedRevision.revision?.id || '')}" class="w-full mt-3 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-bold">提交内容更新并生成新版本</button><p class="text-[10px] text-zinc-500 mt-2 text-center">点击此按钮才会创建付费生成任务；未变化页面直接复用。</p></div>`
    : '';
  return `
    <div class="mt-5 pt-5 border-t border-white/10 space-y-4" id="content-revision-editor">
      <div><p class="text-[12px] font-bold text-white">更新业务内容</p><p class="text-[11px] text-zinc-500 mt-1">设计框架已经锁定，只允许更新内容，不会重新换风格。</p></div>
      <button id="content-check-tencent-btn" class="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[12px] text-sky-300 font-bold">检测腾讯文档最新内容</button>
      ${check}
      <div>
        <label class="block text-[11px] font-bold text-zinc-300 mb-2">系统内补充 / 修改内容</label>
        <textarea id="content-revision-text" class="w-full h-28 bg-[#09090b] border border-zinc-700 rounded-xl px-3 py-3 text-[12px] text-white outline-none focus:border-indigo-500 resize-none" placeholder="可填写完整新文案，或说明 P1/P2/P3 哪些内容需要调整"></textarea>
      </div>
      <label class="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer"><input id="content-use-tencent" type="checkbox" class="accent-indigo-500" checked> 同时使用当前腾讯文档内容</label>
      <button id="content-prepare-btn" class="w-full py-3 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-700 text-white rounded-xl text-[12px] font-bold">分析内容变化（不生图）</button>
      ${prepared}
    </div>`;
}

function renderTemplateReview(state, revisionReady = false) {
  const title = revisionReady ? `内容改版 r${state.flow.latest?.revision_no || ''} 待您验收` : '领导已通过设计母版 · 待您验收';
  const copy = revisionReady
    ? '当前改版已经基于领导通过的母版完成。满意可直接验收；若业务内容还需变化，可继续提交内容更新。'
    : '如果当前 Demo 内容已经正确，可以直接作为最终交付验收，不会再次生图；如果业务内容需要变化，请走“内容需要调整”。';
  return `
    <div class="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
    <h3 class="text-[16px] font-bold text-emerald-400 mb-2">${esc(title)}</h3>
    <p class="text-[12px] text-zinc-400 leading-relaxed mb-5">${esc(copy)}</p>
    <div class="space-y-3">
      <button id="template-accept-btn" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[13px] font-bold">确认验收并完结</button>
      <button id="content-toggle-btn" class="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-[12px] font-bold">内容需要调整</button>
    </div>
    ${panelOpen ? contentEditor() : ''}`;
}

function renderState(state) {
  const panel = actionPanel();
  if (!panel || !isRequesterUser(currentUser())) return;
  const flow = state.flow.kind;
  if (!['framework_rejected_waiting_requester','template_review','content_revision_review','content_revision_generating','capacity_conflict','content_revision_draft'].includes(flow)) return;
  painting = true;
  panel.className = 'bg-[#121217] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden';
  if (flow === 'framework_rejected_waiting_requester') panel.innerHTML = renderRejected(state);
  else if (flow === 'content_revision_generating') panel.innerHTML = `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div><h3 class="text-[16px] font-bold text-indigo-300">内容改版生成中</h3><p class="text-[12px] text-zinc-400 mt-2 leading-relaxed">AI 正在基于领导已通过的设计母版，只生成发生变化的页面。未变化页面继续复用原图。</p>`;
  else if (flow === 'capacity_conflict') panel.innerHTML = `<div class="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-500"></div><h3 class="text-[16px] font-bold text-amber-300">最新内容超出已通过框架容量</h3><p class="text-[12px] text-zinc-400 mt-2 leading-relaxed">框架已经由领导确认，系统不会擅自改变设计方向。请精简、拆分或重新组织内容后再次提交。</p><button id="content-toggle-btn" class="w-full mt-5 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-[12px] font-bold">重新调整内容</button>${panelOpen ? contentEditor() : ''}`;
  else if (flow === 'content_revision_draft') {
    preparedRevision = { status: 'content_ready', revision: state.flow.latest, affected_pages: state.flow.latest?.affected_pages || [] };
    panelOpen = true;
    panel.innerHTML = renderTemplateReview(state, false);
  } else panel.innerHTML = renderTemplateReview(state, flow === 'content_revision_review');
  bindPanelEvents(state);
  painting = false;
}

function bindPanelEvents(state) {
  document.getElementById('content-toggle-btn')?.addEventListener('click', () => { panelOpen = !panelOpen; preparedRevision = null; renderState(state); });
  document.getElementById('framework-revision-generate-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const direction = String(document.getElementById('framework-requester-direction')?.value || '').trim();
    if (!direction) return notify('请补充调整要求', '请先填写你与领导沟通后确认的本轮框架调整方向。', 'error');
    button.disabled = true; button.textContent = '正在提交…';
    try {
      await client().generateFrameworkRevision(sb, id, {
        requester_direction: direction,
        refresh_tencent_doc: Boolean(document.getElementById('framework-refresh-tencent')?.checked),
        supplemental_content: String(document.getElementById('framework-supplemental-content')?.value || '').trim(),
      });
      notify('已提交', 'AI 已收到明确调整方向，新一轮框架已进入队列。');
      await sync(true);
    } catch (error) { notify('提交失败', error.message || String(error), 'error'); button.disabled = false; button.textContent = '提交调整要求，重新生成框架'; }
  });
  document.getElementById('template-accept-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!window.confirm('确认以当前版本作为最终交付并完成验收？此操作不会触发再次生图。')) return;
    button.disabled = true; button.textContent = '正在验收…';
    try { await client().acceptCurrentRevision(sb, id); notify('验收完成', '当前版本已直接验收，未触发新的图片生成。'); location.reload(); }
    catch (error) { notify('验收失败', error.message || String(error), 'error'); button.disabled = false; button.textContent = '确认验收并完结'; }
  });
  document.getElementById('content-check-tencent-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = '正在读取腾讯文档…';
    try { lastCheck = await client().checkContentUpdate(sb, id); notify('检测完成', lastCheck.changed ? '检测到腾讯文档有新内容。' : '腾讯文档未检测到新变化。', lastCheck.changed ? 'info' : 'success'); renderState(state); }
    catch (error) { notify('检测失败', error.message || String(error), 'error'); }
  });
  document.getElementById('content-prepare-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const text = String(document.getElementById('content-revision-text')?.value || '').trim();
    const useTencent = Boolean(document.getElementById('content-use-tencent')?.checked);
    if (!text && !useTencent) return notify('没有新内容', '请填写系统内修改内容，或勾选使用腾讯文档。', 'error');
    const sourceMode = text && useTencent ? 'combined' : text ? 'system_text' : 'tencent_doc';
    button.disabled = true; button.textContent = '正在分析差异…';
    try {
      preparedRevision = await client().prepareContentRevision(sb, id, { source_mode: sourceMode, system_content: text, refresh_tencent_doc: false });
      if (preparedRevision.status === 'no_change') notify('没有需要重生的内容', '当前内容与可验收版本一致，可以直接验收。', 'success');
      else if (preparedRevision.status === 'capacity_conflict') notify('内容容量冲突', '新内容超出已通过母版承载范围，请先精简内容。', 'error');
      else if (preparedRevision.status === 'content_ready') notify('差异分析完成', `仅需重新生成：P${(preparedRevision.affected_pages || []).join('、P')}`, 'success');
      await sync(true);
    } catch (error) { notify('分析失败', error.message || String(error), 'error'); button.disabled = false; button.textContent = '分析内容变化（不生图）'; }
  });
  document.getElementById('content-revision-generate-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget, revisionId = String(button.dataset.revisionId || '');
    if (!revisionId) return;
    if (!window.confirm('确认基于已通过设计母版生成本轮内容改版？只会生成发生变化的页面。')) return;
    button.disabled = true; button.textContent = '正在提交生成队列…';
    try { await client().generateContentRevision(sb, id, revisionId); notify('已提交生成', '仅受影响页面已进入生成队列。'); preparedRevision = null; panelOpen = false; await sync(true); }
    catch (error) { notify('提交失败', error.message || String(error), 'error'); button.disabled = false; button.textContent = '提交内容更新并生成新版本'; }
  });
}

function installLeaderOverrides() {
  if (!originalSubmitApprove && typeof window.submitApprove === 'function') originalSubmitApprove = window.submitApprove;
  if (!originalSubmitReject && typeof window.submitReject === 'function') originalSubmitReject = window.submitReject;
  window.submitApprove = async function() {
    try {
      const state = await loadState();
      if (state.task?.assignee !== 'davis.design.ai' || !isLeaderUser(currentUser()) || state.task.status !== 'pending_approval') return originalSubmitApprove?.();
      const note = String(document.getElementById('approve-notes')?.value || '').trim();
      await client().approveFramework(sb, id, note);
      window.closeActionModals?.(); notify('审批通过', '框架已冻结为该需求设计母版，现转需求方验收。'); setTimeout(() => location.reload(), 500);
    } catch (error) { notify('审批失败', error.message || String(error), 'error'); }
  };
  window.submitReject = async function() {
    try {
      const state = await loadState();
      if (state.task?.assignee !== 'davis.design.ai' || !isLeaderUser(currentUser()) || state.task.status !== 'pending_approval') return originalSubmitReject?.();
      const reason = String(document.getElementById('reject-reason')?.value || '').trim();
      await client().rejectFramework(sb, id, reason);
      window.closeActionModals?.(); notify('已驳回', '任务已回到需求方，AI 不会自动重新生图。', 'info'); setTimeout(() => location.reload(), 500);
    } catch (error) { notify('驳回失败', error.message || String(error), 'error'); }
  };
}

async function sync(force = false) {
  if (syncing || !sb || !id) return;
  syncing = true;
  try {
    installLeaderOverrides();
    const state = await loadState();
    if (state.task?.assignee !== 'davis.design.ai') return;
    const snapshot = JSON.stringify({ status: state.task.status, template: state.template?.id || '', revision: state.flow.latest?.id || '', revisionStatus: state.flow.latest?.status || '', formal: state.flow.formal?.action || '', panelOpen, prepared: preparedRevision?.revision?.id || preparedRevision?.status || '', check: lastCheck?.new_hash || '' });
    if (!force && snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    renderState(state);
  } catch (error) { console.error('需求方母版/内容改版流程加载失败:', error); }
  finally { syncing = false; }
}

export function bootstrapRequesterFrameworkRevisionFlowV1(clientInstance) {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  if (window.__requesterFrameworkRevisionV1) return;
  window.__requesterFrameworkRevisionV1 = true;
  sb = clientInstance; id = currentTaskId();
  const start = () => {
    sync(true);
    timer = setInterval(() => sync(false), 4000);
    const panel = actionPanel();
    if (panel) { observer = new MutationObserver(() => { if (!painting) setTimeout(() => sync(true), 30); }); observer.observe(panel, { childList: true, subtree: false }); }
    let attempts = 0;
    const overrideTimer = setInterval(() => { installLeaderOverrides(); if (++attempts > 50) clearInterval(overrideTimer); }, 100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('beforeunload', () => { clearInterval(timer); observer?.disconnect(); }, { once: true });
}
