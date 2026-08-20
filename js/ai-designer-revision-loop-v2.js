import { activeRevision, feedbackCoveredByRevision, latestRequesterFeedback, nextRevisionNo, parseHistory, revisionStage } from './revision-cycle-core.mjs?v=revision-loop-v1';
import { prepareContentRevision } from './ai-requirement-client.js?v=revision-loop-v2';

let sb = null;
let timer = null;
let busy = false;
let lastKey = '';
const attempts = new Map();
const errors = new Map();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
function selectedTaskId() { return String(document.querySelector('#taskList .task.active')?.dataset?.id || '').trim(); }

async function load(taskId) {
  const [taskResult, templateResult, revisionsResult, analysesResult, clarificationsResult] = await Promise.all([
    sb.from('test_tasks').select('*').eq('id', taskId).single(),
    sb.from('uat_framework_templates').select('*').eq('task_id', taskId).maybeSingle(),
    sb.from('uat_content_revisions').select('*').eq('task_id', taskId).order('revision_no', { ascending:false }),
    sb.from('uat_requirement_analyses').select('*').eq('task_id', taskId).order('version', { ascending:false }),
    sb.from('uat_clarifications').select('*').eq('task_id', taskId).order('created_at', { ascending:true }),
  ]);
  const error = taskResult.error || templateResult.error || revisionsResult.error || analysesResult.error || clarificationsResult.error;
  if (error) throw error;
  const task = taskResult.data;
  const template = templateResult.data || null;
  const revisions = revisionsResult.data || [];
  const latest = activeRevision(revisions);
  const history = parseHistory(task.history_json);
  const feedback = latestRequesterFeedback(history);
  const analyses = analysesResult.data || [];
  const analysis = latest?.analysis_id ? analyses.find((item) => String(item.id) === String(latest.analysis_id)) || null : null;
  const currentAnalysis = analysis || analyses[0] || null;
  const clarifications = (clarificationsResult.data || []).filter((item) => String(item.analysis_id || '') === String(currentAnalysis?.id || ''));
  const openClarifications = clarifications.filter((item) => String(item.status || '') === 'open');
  return { task, template, revisions, latest, history, feedback, analyses, analysis, currentAnalysis, clarifications, openClarifications };
}

function affectedText(revision) {
  const pages = (revision?.affected_pages || []).map(Number).filter(Boolean).sort((a,b)=>a-b);
  return pages.length ? `P${pages.join('、P')}` : '等待 AI 判断';
}

function revisionTimeline(revisions, feedback) {
  const items = [...revisions].sort((a,b)=>Number(a.revision_no||0)-Number(b.revision_no||0));
  const pending = feedback && !feedbackCoveredByRevision(feedback, activeRevision(revisions));
  if (!items.length && !pending) return '<p class="text-xs text-slate-500">尚未产生内容修改轮次。</p>';
  const rows = items.map((revision) => {
    const stage = revisionStage(revision.status);
    const text = String(revision.system_content || revision.change_summary?.requester_feedback || '').trim();
    const pages = affectedText(revision);
    const understoodAt = revision.submitted_at || revision.created_at || '';
    const deliveredAt = revision.generated_at || '';
    return `<div class="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-white">第 ${Number(revision.revision_no||0)} 次修改</p><span class="text-xs ${stage.key==='accepted'?'text-emerald-300':stage.key==='failed'?'text-rose-300':stage.key==='generating'?'text-violet-300':'text-blue-300'}">${esc(stage.label)}</span></div><p class="text-xs text-slate-500 mt-2">影响页：${esc(pages)}</p>${text?`<p class="text-xs text-slate-300 mt-2 leading-relaxed">需求方：${esc(text)}</p>`:''}<div class="mt-2 text-[10px] text-slate-600">${understoodAt?`理解/建轮：${new Date(understoodAt).toLocaleString()}`:''}${deliveredAt?` · 交付：${new Date(deliveredAt).toLocaleString()}`:''}</div></div>`;
  });
  if (pending) rows.push(`<div class="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4"><div class="flex items-center justify-between"><p class="text-sm font-bold text-blue-200">第 ${nextRevisionNo(revisions)} 次修改</p><span class="text-xs text-blue-300">${stateLabelForPending()}</span></div><p class="text-xs text-slate-300 mt-2 leading-relaxed">需求方：${esc(feedback.feedback)}</p></div>`);
  return `<div class="space-y-3">${rows.join('')}</div>`;
}
function stateLabelForPending() { return 'AI 理解/追问中'; }

function arrayLines(value, fallback = '') {
  const items = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!items.length) return fallback;
  return `<ul class="mt-2 space-y-1">${items.map((item)=>`<li class="text-xs text-slate-300">• ${esc(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')}</ul>`;
}

function analysisHtml(context) {
  const revision = context.latest;
  const analysis = context.currentAnalysis;
  if (!analysis) return '<div class="rounded-xl border border-blue-500/20 bg-blue-950/15 p-5"><p class="text-sm font-bold text-blue-200">AI 正在进行真实需求理解</p><p class="text-xs text-slate-400 mt-2">会调用当前 DeepSeek 需求理解服务，判断业务变化、设计稿纠错和受影响页面，不是占位状态。</p></div>';
  const brief = analysis.brief || {};
  const pages = revision ? affectedText(revision) : '等待补充后继续判断';
  const reason = String(revision?.change_summary?.reason || '').trim();
  const confidence = Number(brief.confidence || analysis.confidence || 0);
  const conflicts = brief.conflicts || brief.content_conflicts || [];
  const missing = brief.missing_information || [];
  const questions = context.openClarifications || [];
  const pageRows = revision ? (Array.isArray(brief.pages) ? brief.pages : []).filter((page) => (revision.affected_pages || []).map(Number).includes(Number(page.index || page.page_index))).map((page) => `<li class="text-xs text-slate-300">P${Number(page.index || page.page_index)} ${esc(page.title || '')}${page.copy ? `：${esc(String(page.copy).slice(0,140))}` : ''}</li>`).join('') : '';
  return `<div class="rounded-xl border border-blue-500/20 bg-blue-950/15 p-5"><div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-blue-200">AI 真实理解结果${revision ? ` · 第 ${revision.revision_no} 次修改` : ''}</p><span class="text-[11px] text-blue-300">DeepSeek analysis v${analysis.version || '-'}${confidence ? ` · ${Math.round(confidence*100)}%` : ''}</span></div>${brief.goal?`<p class="text-xs text-slate-300 mt-3"><span class="text-slate-500">本轮目标：</span>${esc(brief.goal)}</p>`:''}<p class="text-xs text-slate-400 mt-3">当前 affected pages：<span class="text-white font-bold">${esc(pages)}</span></p>${reason?`<p class="text-xs text-slate-400 mt-2">判断原因：${esc(reason)}</p>`:''}${conflicts?.length?`<div class="mt-4"><p class="text-[11px] font-bold text-amber-300">识别到的冲突</p>${arrayLines(conflicts)}</div>`:''}${missing?.length?`<div class="mt-4"><p class="text-[11px] font-bold text-amber-300">仍缺少的信息</p>${arrayLines(missing)}</div>`:''}${questions.length?`<div class="mt-4 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3"><p class="text-[11px] font-bold text-amber-300">AI 已向需求方追问</p>${arrayLines(questions.map(q=>q.question))}<p class="text-[10px] text-slate-500 mt-2">等待需求方在自己的验收/修改卡中回答，回答后继续同一轮 DeepSeek 分析。</p></div>`:''}${pageRows?`<ul class="mt-3 space-y-2">${pageRows}</ul>`:''}</div>`;
}

function currentStatus(context) {
  const { latest, feedback, task, openClarifications } = context;
  const err = errors.get(task.id) || '';
  if (err) return `<div class="rounded-xl border border-rose-500/25 bg-rose-950/20 p-5"><p class="text-sm font-bold text-rose-300">本轮自动处理失败</p><p class="text-xs text-rose-200 mt-2">${esc(err)}</p><p class="text-[11px] text-slate-500 mt-2">不会推倒母版，也不会丢失上一可验收版本。</p></div>`;
  if (openClarifications?.length) return `<div class="rounded-xl border border-amber-500/25 bg-amber-950/15 p-5"><p class="text-sm font-bold text-amber-300">第 ${nextRevisionNo(context.revisions)} 次修改 · 等待需求方补充</p><p class="text-xs text-slate-400 mt-2">DeepSeek 已真实理解并提出 ${openClarifications.length} 个关键问题。收到回答后会继续同一轮分析，不会退回初始 Demo 流程。</p></div>`;
  if (!latest && feedback) return `<div class="rounded-xl border border-blue-500/25 bg-blue-950/20 p-5"><div class="flex items-center gap-3"><div class="spin"></div><div><p class="text-sm font-bold text-blue-200">正在理解需求方最新意见</p><p class="text-xs text-slate-400 mt-1">${esc(feedback.feedback)}</p></div></div></div>`;
  if (!latest) return '<div class="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><p class="text-sm text-slate-300">母版已锁定，等待需求方提交新的修改意见。</p></div>';
  const status = String(latest.status || '');
  if (status === 'content_ready') return `<div class="rounded-xl border border-blue-500/25 bg-blue-950/20 p-5"><div class="flex items-center gap-3"><div class="spin"></div><div><p class="text-sm font-bold text-blue-200">AI 已理解，正在进入第 ${latest.revision_no} 次修改生成</p><p class="text-xs text-slate-400 mt-1">需要修改 ${esc(affectedText(latest))}；生图动作由 AI 设计师自动执行。</p></div></div></div>`;
  if (status === 'generation_requested' || status === 'generating') return `<div class="rounded-xl border border-violet-500/25 bg-violet-950/15 p-5"><div class="flex items-center gap-3"><div class="spin"></div><div><p class="text-sm font-bold text-violet-200">第 ${latest.revision_no} 次修改生成中</p><p class="text-xs text-slate-400 mt-1">正在修改 ${esc(affectedText(latest))}；未受影响页复用上一版本。</p></div></div></div>`;
  if (status === 'ready_for_review') return `<div class="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-5"><p class="text-sm font-bold text-emerald-300">第 ${latest.revision_no} 次修改已交付需求方验收</p><p class="text-xs text-slate-400 mt-2">如果需求方继续补充意见，将自动进入第 ${Number(latest.revision_no)+1} 次修改循环；不会回领导审核。</p></div>`;
  if (status === 'accepted') return `<div class="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-5"><p class="text-sm font-bold text-emerald-300">需求方已验收，第 ${latest.revision_no} 次修改为最终版本</p></div>`;
  if (status === 'capacity_conflict') return '<div class="rounded-xl border border-amber-500/25 bg-amber-950/15 p-5"><p class="text-sm font-bold text-amber-300">内容容量冲突</p><p class="text-xs text-slate-400 mt-2">AI 不允许自行改变母版，请需求方精简或重组内容。</p></div>';
  if (status === 'failed') return `<div class="rounded-xl border border-rose-500/25 bg-rose-950/15 p-5"><p class="text-sm font-bold text-rose-300">第 ${latest.revision_no} 次生成失败</p><p class="text-xs text-slate-400 mt-2">上一可验收版本继续保留，可等待需求方下一轮意见。</p></div>`;
  return `<div class="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><p class="text-sm text-slate-300">${esc(revisionStage(status).label)}</p></div>`;
}

function render(context) {
  const detail = document.getElementById('detail');
  if (!detail || !context.template) return;
  const currentRound = context.latest?.revision_no || nextRevisionNo(context.revisions);
  const feedback = context.feedback?.feedback || String(context.latest?.system_content || '').trim() || '暂无新的修改意见';
  detail.dataset.aiRevisionLoop = 'v2';
  detail.innerHTML = `<div data-ai-revision-loop-root="v2"><div class="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5"><div><p class="text-xs font-mono text-blue-400">${esc(context.task.id)}</p><h2 class="text-2xl font-bold text-white mt-2">${esc(context.task.title || '')}</h2><p class="text-sm text-slate-400 mt-2">首次流程进度继续保留在顶部；当前进入第 ${currentRound} 次内容修改循环。</p></div><span class="px-3 py-1.5 rounded-full bg-emerald-950 text-emerald-300 text-xs">母版已锁定 · 不再回领导审核</span></div><div class="grid xl:grid-cols-[1fr_420px] gap-6 mt-6"><div class="space-y-5"><div class="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5"><p class="text-sm font-bold text-emerald-300">首次框架审批结果永久保留</p><p class="text-xs text-slate-400 mt-2">领导已通过母版 ${esc(context.template.framework_version || '')}。后续所有轮次只允许修改内容和受影响页。</p></div><div class="rounded-xl border border-blue-500/25 bg-blue-950/15 p-5"><p class="text-xs text-blue-300 font-bold">需求方本轮最新意见</p><p class="text-base text-white leading-7 mt-3 whitespace-pre-wrap">${esc(feedback)}</p>${context.feedback?.refresh_tencent_doc?'<p class="text-xs text-cyan-300 mt-3">需求方标记：腾讯文档已更新，AI 同时读取最新内容。</p>':''}</div>${analysisHtml(context)}${currentStatus(context)}</div><div class="space-y-5"><div class="rounded-xl bg-slate-950 border border-white/10 p-5"><p class="text-sm font-bold text-white">当前循环规则</p><ul class="text-xs text-slate-400 mt-3 space-y-2"><li>• 需求方只提交修改意见/回答 AI 问题</li><li>• AI 真实理解并判断 affected pages</li><li>• 需要生图时由 AI 设计师自动调用生成</li><li>• 完成后直接回需求方验收</li><li>• 未验收则进入下一次修改循环</li></ul></div><div class="rounded-xl bg-slate-950 border border-white/10 p-5"><div class="flex items-center justify-between"><p class="text-sm font-bold text-white">历次修改记录</p><span class="text-xs text-slate-500">${context.revisions.length} 个已建轮次</span></div><div class="mt-4">${revisionTimeline(context.revisions,context.feedback)}</div></div></div></div></div>`;
}

function keyOf(context) {
  return JSON.stringify({ id:context.task.id,status:context.task.status,template:context.template?.id||'',feedback:context.feedback?.feedback||'',analysis:[context.currentAnalysis?.id,context.currentAnalysis?.version,context.currentAnalysis?.status],clarifications:context.openClarifications.map(q=>[q.id,q.question,q.status]),revisions:context.revisions.map(r=>[r.id,r.revision_no,r.status,r.affected_pages,r.system_content,r.generated_at]),error:errors.get(context.task.id)||'' });
}

async function processUncoveredFeedback(context) {
  if (!context.template || !context.feedback || feedbackCoveredByRevision(context.feedback, context.latest)) return;
  if (['completed','archived','needs_input'].includes(String(context.task.status || '')) || context.openClarifications?.length || busy) return;
  const attemptKey = `${context.feedback.time}:${context.feedback.feedback}`;
  if (attempts.get(context.task.id) === attemptKey) return;
  attempts.set(context.task.id, attemptKey);
  busy = true;
  errors.delete(context.task.id);
  try {
    const refresh = Boolean(context.feedback.refresh_tencent_doc);
    await prepareContentRevision(sb, context.task.id, {
      source_mode: refresh ? 'combined' : 'system_text',
      system_content: context.feedback.feedback,
      requester_feedback: context.feedback.feedback,
      use_tencent_doc: refresh,
      refresh_tencent_doc: refresh,
    });
  } catch (error) {
    errors.set(context.task.id, error instanceof Error ? error.message : String(error));
  } finally { busy = false; }
}

async function sync(force = false) {
  if (!sb) return;
  const taskId = selectedTaskId();
  if (!taskId) return;
  try {
    const context = await load(taskId);
    if (!context.template) return;
    const key = keyOf(context);
    const ownershipLost = !document.getElementById('detail')?.querySelector('[data-ai-revision-loop-root="v2"]');
    if (force || key !== lastKey || ownershipLost) { lastKey = key; render(context); }
    await processUncoveredFeedback(context);
  } catch (error) { console.error('AI revision loop v2 同步失败:', error); }
}

export function bootstrapAiDesignerRevisionLoopV2(client) {
  if ((location.pathname.split('/').pop() || '') !== 'ai-designer-workspace.html' || window.__aiDesignerRevisionLoopV2) return;
  window.__aiDesignerRevisionLoopV2 = true;
  sb = client;
  const start = () => { sync(true); timer = setInterval(() => sync(false), 1800); document.getElementById('taskList')?.addEventListener('click', () => setTimeout(() => sync(true), 100), true); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
  window.addEventListener('beforeunload', () => clearInterval(timer), { once:true });
}
