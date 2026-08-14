import {
  saveVisualReferences,
  deleteVisualReference,
  setPrimaryVisualReference,
  startAutomaticAnalysis,
} from './ai-requirement-client.js';

const MAX_REFERENCES = 6;
const MODEL_EDGE = 500;
let createReferences = [];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = src;
  });
}

export async function compressVisualReference(file) {
  if (!file?.type?.startsWith('image/')) throw new Error(`${file?.name || '文件'} 不是图片`);
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} 超过12MB，请先压缩`);
  const source = await fileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, MODEL_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
  return { file_name: file.name.replace(/\.[^.]+$/, '') + '.jpg', data_url: dataUrl, note: '', is_primary: false, sort_order: 0, width, height };
}

async function compressFiles(fileList, remaining) {
  const files = [...fileList].filter(file => file.type.startsWith('image/')).slice(0, remaining);
  const output = [];
  for (const file of files) output.push(await compressVisualReference(file));
  return output;
}

function notify(title, desc, type = 'info') {
  if (window.showToast) return window.showToast(title, desc, type);
  console.log(title, desc);
}

function renderCreateReferences() {
  const grid = document.getElementById('visual-reference-create-grid');
  const empty = document.getElementById('visual-reference-create-empty');
  const count = document.getElementById('visual-reference-create-count');
  if (!grid) return;
  if (count) count.textContent = `${createReferences.length}/${MAX_REFERENCES}`;
  if (empty) empty.classList.toggle('hidden', createReferences.length > 0);
  grid.innerHTML = createReferences.map((ref, index) => `
    <div class="rounded-2xl border ${ref.is_primary ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 bg-[#09090b]'} overflow-hidden" data-create-ref="${index}">
      <div class="aspect-[4/3] bg-black/30 relative overflow-hidden">
        <img src="${ref.data_url}" class="w-full h-full object-cover" alt="视觉参考">
        <button type="button" data-remove-create-ref="${index}" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-rose-600">×</button>
        <button type="button" data-primary-create-ref="${index}" class="absolute left-2 top-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${ref.is_primary ? 'bg-indigo-500 text-white' : 'bg-black/70 text-zinc-300'}">${ref.is_primary ? '★ 主参考' : '设为主参考'}</button>
      </div>
      <div class="p-3">
        <p class="text-[11px] text-zinc-400 truncate mb-2">${escapeHtml(ref.file_name)}</p>
        <input data-note-create-ref="${index}" value="${escapeHtml(ref.note)}" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:border-indigo-500" placeholder="例如：参考这张的配色 / 排版 / IP">
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('[data-remove-create-ref]').forEach(button => button.onclick = () => {
    createReferences.splice(Number(button.dataset.removeCreateRef), 1);
    if (createReferences.length && !createReferences.some(item => item.is_primary)) createReferences[0].is_primary = true;
    createReferences.forEach((item, idx) => item.sort_order = idx);
    renderCreateReferences();
  });
  grid.querySelectorAll('[data-primary-create-ref]').forEach(button => button.onclick = () => {
    const selected = Number(button.dataset.primaryCreateRef);
    createReferences.forEach((item, idx) => item.is_primary = idx === selected);
    renderCreateReferences();
  });
  grid.querySelectorAll('[data-note-create-ref]').forEach(input => input.oninput = () => {
    const ref = createReferences[Number(input.dataset.noteCreateRef)];
    if (ref) ref.note = input.value;
  });
}

function installCreateFormPanel(supabase) {
  if (document.getElementById('visual-reference-create-panel')) return;
  const genericUpload = document.getElementById('real-file-upload');
  const anchor = genericUpload?.closest('.grid');
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', `
    <section id="visual-reference-create-panel" class="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] p-5">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="flex items-center gap-2"><span class="text-[13px] font-bold text-white">视觉参考 / 风格参考</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/20">AI平面需求必填</span></div>
          <p class="text-[11px] text-zinc-500 mt-1.5">上传 1–6 张。可指定主参考并说明参考点；千问视觉会先真正看图，再把风格结论交给 DeepSeek 和 FLUX.2。</p>
        </div>
        <span id="visual-reference-create-count" class="text-xs text-indigo-300 font-mono">0/${MAX_REFERENCES}</span>
      </div>
      <label class="h-20 rounded-xl border border-dashed border-indigo-500/40 bg-black/20 hover:bg-indigo-500/10 cursor-pointer flex items-center justify-center text-center transition-colors">
        <div><p class="text-sm font-bold text-indigo-300">＋ 添加参考图</p><p class="text-[10px] text-zinc-600 mt-1">JPG / PNG / WEBP，可多选；系统自动压缩为模型参考副本</p></div>
        <input id="visual-reference-create-input" type="file" multiple accept="image/*" class="hidden">
      </label>
      <div id="visual-reference-create-empty" class="text-center text-[11px] text-zinc-600 mt-4">还没有视觉参考。指派给 AI 设计师的平面需求不会在这里“自由乱画”。</div>
      <div id="visual-reference-create-grid" class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4"></div>
    </section>
  `);
  document.getElementById('visual-reference-create-input').onchange = async (event) => {
    try {
      const added = await compressFiles(event.target.files, MAX_REFERENCES - createReferences.length);
      createReferences.push(...added);
      if (createReferences.length && !createReferences.some(item => item.is_primary)) createReferences[0].is_primary = true;
      createReferences.forEach((item, idx) => item.sort_order = idx);
      renderCreateReferences();
    } catch (error) { notify('参考图处理失败', error.message, 'error'); }
    event.target.value = '';
  };

  const installWrappers = async () => {
    for (let attempt = 0; attempt < 100 && typeof window.submitNewReq !== 'function'; attempt += 1) await sleep(50);
    if (typeof window.submitNewReq !== 'function' || window.submitNewReq.__visualReferenceWrapped) return;
    if (typeof window.openModal === 'function') {
      const originalOpenModal = window.openModal;
      window.openModal = function(modalId, isEdit = false) {
        if (modalId === 'create-modal' && !isEdit) {
          createReferences = [];
          renderCreateReferences();
        }
        return originalOpenModal.apply(this, arguments);
      };
    }
    const originalSubmit = window.submitNewReq;
    const wrapped = async function() {
      const assignee = document.getElementById('req-assignee')?.value || 'none';
      const typeRadios = [...document.querySelectorAll('input[name="rt"]')];
      const selectedTypeIndex = Math.max(0, typeRadios.findIndex(item => item.checked));
      const requestType = selectedTypeIndex === 1 ? '视频动效' : '平面视觉';
      const title = document.getElementById('req-short-title')?.value.trim() || '';
      const user = JSON.parse(localStorage.getItem('activeUserObj') || '{}');
      const creator = user.displayName || user.cnName || user.enName || '';
      if (assignee === 'davis.design.ai' && requestType === '平面视觉' && createReferences.length === 0) {
        if (window.showAlert) window.showAlert('还缺视觉参考', '指派给 AI 设计师的平面需求至少需要 1 张视觉参考图。AI 不会在没有参考的情况下自行乱生成。', 'info');
        return;
      }
      await originalSubmit.apply(this, arguments);
      if (!title || assignee !== 'davis.design.ai') return;
      const { data: rows } = await supabase.from('test_tasks').select('id').eq('title', title).eq('creator', creator).eq('assignee', assignee).order('created_at', { ascending: false }).limit(1);
      const taskId = rows?.[0]?.id;
      if (!taskId) return;
      await supabase.from('test_tasks').update({ request_type: requestType }).eq('id', taskId);
      if (requestType === '平面视觉' && createReferences.length) {
        try {
          await saveVisualReferences(supabase, taskId, createReferences, { replace: true });
          await startAutomaticAnalysis(supabase, taskId);
          notify('视觉参考已交给 AI', `已保存 ${createReferences.length} 张参考图，千问视觉会先看图，再自动继续理解与出 Demo。`, 'success');
        } catch (error) {
          notify('参考图保存失败', `工单已创建并暂停在“等待视觉参考”：${error.message}`, 'error');
        }
      } else if (requestType !== '平面视觉') {
        try { await startAutomaticAnalysis(supabase, taskId); } catch { /* original flow already tried */ }
      }
    };
    wrapped.__visualReferenceWrapped = true;
    window.submitNewReq = wrapped;
  };
  installWrappers();
}

function referenceCard(ref, interactive = false) {
  return `<div class="rounded-xl overflow-hidden border ${ref.is_primary ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-white/10 bg-black/20'}">
    <div class="aspect-[4/3] relative overflow-hidden bg-black"><img src="${ref.data_url}" class="w-full h-full object-cover" alt="视觉参考">${ref.is_primary ? '<span class="absolute left-2 top-2 text-[10px] font-bold bg-indigo-500 text-white px-2 py-1 rounded-full">★ 主参考</span>' : ''}</div>
    <div class="p-3"><p class="text-[11px] text-zinc-300 truncate">${escapeHtml(ref.file_name)}</p><p class="text-[10px] text-zinc-500 mt-1 min-h-[14px]">${escapeHtml(ref.note || '未备注')}</p>${interactive ? `<div class="flex gap-2 mt-2"><button data-set-primary-ref="${ref.id}" class="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20">设主参考</button><button data-delete-ref="${ref.id}" class="text-[10px] px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20">删除</button></div>` : ''}</div>
  </div>`;
}

function visualAnalysisSummary(analysis) {
  if (!analysis || typeof analysis !== 'object') return '';
  const style = analysis.style_summary || '';
  const keywords = Array.isArray(analysis.style_keywords) ? analysis.style_keywords.slice(0, 8).join(' · ') : '';
  const typography = Array.isArray(analysis.typography_style) ? analysis.typography_style.slice(0, 4).join('；') : '';
  const composition = Array.isArray(analysis.composition_patterns) ? analysis.composition_patterns.slice(0, 3).join('；') : '';
  return `<div class="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4"><div class="flex items-center justify-between gap-3"><p class="text-xs font-bold text-cyan-300">千问视觉已理解参考图</p></div><p class="text-sm text-white mt-2">${escapeHtml(style || '已完成视觉分析')}</p>${keywords ? `<p class="text-[11px] text-cyan-200/80 mt-2">${escapeHtml(keywords)}</p>` : ''}${composition ? `<p class="text-[11px] text-zinc-400 mt-2"><span class="text-zinc-500">构图：</span>${escapeHtml(composition)}</p>` : ''}${typography ? `<p class="text-[11px] text-zinc-400 mt-1"><span class="text-zinc-500">字体：</span>${escapeHtml(typography)}</p>` : ''}</div>`;
}

async function installRequesterDetailPanel(supabase) {
  if (document.getElementById('visual-reference-detail-panel')) return;
  const aiPanel = document.getElementById('ai-requirement-panel');
  if (!aiPanel) return;
  const taskId = new URLSearchParams(location.search).get('id');
  if (!taskId) return;
  aiPanel.insertAdjacentHTML('beforebegin', `
    <section id="visual-reference-detail-panel" class="bg-[#121217] border border-indigo-500/20 rounded-2xl p-7 relative overflow-hidden">
      <div class="flex justify-between gap-4 items-start mb-5"><div><h3 class="text-sm font-bold text-white">🎨 视觉参考 / 风格参考</h3><p class="text-[11px] text-zinc-500 mt-1">AI 平面设计至少需要1张。上传后千问视觉先看图，随后 AI 自动继续流程。</p></div><span id="visual-reference-detail-count" class="text-xs text-indigo-300"></span></div>
      <div id="visual-reference-detail-grid" class="grid grid-cols-2 lg:grid-cols-3 gap-3"></div>
      <div id="visual-reference-analysis-summary"></div>
      <div id="visual-reference-detail-upload" class="mt-4 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/[0.04] p-4">
        <label class="cursor-pointer block text-center"><span class="text-xs font-bold text-indigo-300">＋ 添加参考图</span><input id="visual-reference-detail-input" type="file" multiple accept="image/*" class="hidden"></label>
        <div id="visual-reference-pending-grid" class="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3"></div>
        <button id="visual-reference-detail-save" class="hidden mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">保存参考图并交给 AI</button>
      </div>
    </section>
  `);

  let pending = [];
  const renderPending = () => {
    const container = document.getElementById('visual-reference-pending-grid');
    const save = document.getElementById('visual-reference-detail-save');
    if (!container) return;
    container.innerHTML = pending.map((ref, idx) => `<div class="rounded-xl border border-white/10 overflow-hidden bg-black/20"><img src="${ref.data_url}" class="w-full aspect-[4/3] object-cover"><div class="p-2"><input data-pending-note="${idx}" class="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" placeholder="参考点（选填）"><button data-pending-primary="${idx}" class="mt-2 w-full text-[10px] rounded-lg py-1.5 ${ref.is_primary ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}">${ref.is_primary ? '★ 主参考' : '设为主参考'}</button></div></div>`).join('');
    save?.classList.toggle('hidden', pending.length === 0);
    container.querySelectorAll('[data-pending-note]').forEach(input => input.oninput = () => pending[Number(input.dataset.pendingNote)].note = input.value);
    container.querySelectorAll('[data-pending-primary]').forEach(button => button.onclick = () => { pending.forEach((ref, idx) => ref.is_primary = idx === Number(button.dataset.pendingPrimary)); renderPending(); });
  };

  const refresh = async () => {
    const [{ data: refs, error }, { data: task }, { data: analyses }] = await Promise.all([
      supabase.from('uat_visual_references').select('*').eq('task_id', taskId).order('sort_order', { ascending: true }),
      supabase.from('test_tasks').select('status,assignee,request_type').eq('id', taskId).single(),
      supabase.from('uat_requirement_analyses').select('status,brief,prompt_version,version').eq('task_id', taskId).order('version', { ascending: false }).limit(1),
    ]);
    if (error) return;
    const list = refs || [];
    const currentAnalysis = analyses?.[0]?.status === 'stale' ? null : analyses?.[0];
    const grid = document.getElementById('visual-reference-detail-grid');
    const count = document.getElementById('visual-reference-detail-count');
    if (count) count.textContent = `${list.length}/${MAX_REFERENCES} 张`;
    if (grid) grid.innerHTML = list.length ? list.map(ref => referenceCard(ref, true)).join('') : '<div class="col-span-full text-center py-6 rounded-xl bg-black/20 border border-dashed border-white/10 text-xs text-amber-300">尚未上传视觉参考，AI 会停在“等待视觉参考”。</div>';
    const summary = document.getElementById('visual-reference-analysis-summary');
    if (summary) summary.innerHTML = visualAnalysisSummary(currentAnalysis?.brief?.visual_reference_analysis);
    grid?.querySelectorAll('[data-set-primary-ref]').forEach(button => button.onclick = async () => { await setPrimaryVisualReference(supabase, taskId, button.dataset.setPrimaryRef); await refresh(); });
    grid?.querySelectorAll('[data-delete-ref]').forEach(button => button.onclick = async () => { await deleteVisualReference(supabase, taskId, button.dataset.deleteRef); await refresh(); });
    document.getElementById('visual-reference-detail-upload')?.classList.toggle('hidden', task?.assignee !== 'davis.design.ai' || task?.request_type === '视频动效' || list.length >= MAX_REFERENCES);
  };

  document.getElementById('visual-reference-detail-input').onchange = async (event) => {
    const { data: existing } = await supabase.from('uat_visual_references').select('id').eq('task_id', taskId);
    try {
      pending = await compressFiles(event.target.files, MAX_REFERENCES - (existing?.length || 0));
      if (pending.length) pending[0].is_primary = (existing?.length || 0) === 0;
      pending.forEach((item, idx) => item.sort_order = (existing?.length || 0) + idx);
      renderPending();
    } catch (error) { notify('参考图处理失败', error.message, 'error'); }
    event.target.value = '';
  };

  document.getElementById('visual-reference-detail-save').onclick = async () => {
    if (!pending.length) return;
    try {
      await saveVisualReferences(supabase, taskId, pending);
      pending = [];
      renderPending();
      await refresh();
      const { data: task } = await supabase.from('test_tasks').select('status').eq('id', taskId).single();
      if (task?.status === 'waiting_visual_reference' || task?.status === 'analysis_failed') {
        await startAutomaticAnalysis(supabase, taskId);
        notify('AI 已自动继续', '千问视觉会先理解参考图，随后 DeepSeek 重新理解3页需求并自动生成 Demo。', 'success');
        setTimeout(() => location.reload(), 1200);
      }
    } catch (error) { notify('保存失败', error.message, 'error'); }
  };
  await refresh();
}

async function installAiWorkspaceCompanion(supabase) {
  if (window.__davisAiWorkspaceCompanionInstalled) return;
  window.__davisAiWorkspaceCompanionInstalled = true;
  let rendering = false;
  const render = async () => {
    if (rendering) return;
    rendering = true;
    try {
      document.getElementById('demoBtn')?.remove();
      const duplicates = [...document.querySelectorAll('#ai-visual-context-panel')];
      duplicates.slice(1).forEach(node => node.remove());
      const active = document.querySelector('.task.active');
      const taskId = active?.dataset?.id;
      const detail = document.getElementById('detail');
      if (!taskId || !detail || document.getElementById('ai-visual-context-panel')) return;
      const [{ data: refs }, { data: generations }, { data: task }, { data: analyses }] = await Promise.all([
        supabase.from('uat_visual_references').select('*').eq('task_id', taskId).order('sort_order', { ascending: true }),
        supabase.from('uat_design_generations').select('*').eq('task_id', taskId).eq('kind', 'demo').order('page_index', { ascending: true }),
        supabase.from('test_tasks').select('status,summary_desc').eq('id', taskId).single(),
        supabase.from('uat_requirement_analyses').select('status,brief,prompt_version,version').eq('task_id', taskId).order('version', { ascending: false }).limit(1),
      ]);
      if (document.getElementById('ai-visual-context-panel')) return;
      const currentDemos = (generations || []).filter(item => ['generating', 'ready', 'confirmed'].includes(item.status));
      const refList = refs || [];
      const currentAnalysis = analyses?.[0]?.status === 'stale' ? null : analyses?.[0];
      const stateCopy = task?.status === 'waiting_visual_reference' ? '等待需求方上传视觉参考' : task?.status === 'generating_demo' ? 'AI 正在按页生成 Demo' : task?.summary_desc || task?.status || '';
      const panel = document.createElement('div');
      panel.id = 'ai-visual-context-panel';
      panel.className = 'mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5';
      panel.innerHTML = `<div class="flex justify-between gap-4 mb-4"><div><h3 class="text-sm font-bold text-white">视觉参考与多页生成</h3><p class="text-xs text-indigo-300 mt-1">${escapeHtml(stateCopy)}</p></div><span class="text-xs text-slate-400">参考 ${refList.length} 张 · Demo ${currentDemos.length} 张</span></div>
        <div class="grid grid-cols-4 gap-2 mb-4">${refList.slice(0, 6).map(ref => `<div class="relative aspect-square rounded-lg overflow-hidden border ${ref.is_primary ? 'border-indigo-400' : 'border-white/10'}"><img src="${ref.data_url}" class="w-full h-full object-cover">${ref.is_primary ? '<span class="absolute left-1 top-1 text-[9px] bg-indigo-500 px-1.5 py-0.5 rounded">主</span>' : ''}</div>`).join('') || '<div class="col-span-4 text-xs text-amber-300 py-3">尚无视觉参考，AI 不会生成 Demo。</div>'}</div>
        ${visualAnalysisSummary(currentAnalysis?.brief?.visual_reference_analysis)}
        ${currentDemos.length ? `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">${currentDemos.map(demo => `<div class="rounded-lg border border-white/10 bg-black/20 p-3"><div class="flex justify-between text-[10px] mb-2"><span class="text-white font-bold">Demo ${String(demo.page_index || 1).padStart(2, '0')} / ${String(demo.page_count || currentDemos.length).padStart(2, '0')}</span><span class="text-slate-500">${escapeHtml(demo.status)}</span></div>${demo.output?.image_url ? `<img src="${demo.output.image_url}" class="w-full rounded-md bg-white">` : '<div class="aspect-[3/4] flex items-center justify-center text-xs text-slate-600">生成中…</div>'}<p class="text-[10px] text-slate-500 mt-2 truncate">${escapeHtml(demo.model || '')} · ${escapeHtml(demo.output?.size ? `${demo.output.size.width}×${demo.output.size.height}` : '')}</p></div>`).join('')}</div>` : ''}`;
      detail.appendChild(panel);
    } finally {
      rendering = false;
    }
  };
  const observer = new MutationObserver(() => { document.getElementById('demoBtn')?.remove(); setTimeout(render, 50); });
  const detail = document.getElementById('detail');
  if (detail) observer.observe(detail, { childList: true, subtree: true });
  window.__davisAiWorkspaceVisualTimer ||= setInterval(render, 1800);
  await render();
}

export function bootstrapVisualReferenceUI(supabase) {
  if (window.__davisVisualReferenceUIBootstrapped) return;
  window.__davisVisualReferenceUIBootstrapped = true;
  const path = location.pathname.split('/').pop() || 'index.html';
  const start = async () => {
    if (path === 'index.html' || path === '') installCreateFormPanel(supabase);
    if (path === 'task-detail-requester.html') await installRequesterDetailPanel(supabase);
    if (path === 'ai-designer-workspace.html') await installAiWorkspaceCompanion(supabase);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  else start();
}
