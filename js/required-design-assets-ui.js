import { startAutomaticAnalysis } from './ai-requirement-client.js';

const MAX_ASSETS = 6;
const ASSET_EDGE = 900;
let createAssets = [];

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function notify(title, desc, type = 'info') {
  if (window.showToast) return window.showToast(title, desc, type);
  console.log(title, desc, type);
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('素材读取失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('素材图片解码失败'));
    image.src = src;
  });
}

async function compressAsset(file) {
  if (!file?.type?.startsWith('image/')) throw new Error(`${file?.name || '文件'} 不是图片`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} 超过15MB，请先压缩`);
  const source = await fileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, ASSET_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const dataUrl = preserveAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
  return {
    file_name: file.name.replace(/\.[^.]+$/, '') + (preserveAlpha ? '.png' : '.jpg'),
    data_url: dataUrl,
    asset_role: '',
    note: '',
    sort_order: 0,
    width,
    height,
  };
}

async function compressFiles(fileList, remaining) {
  const files = [...fileList].filter(file => file.type.startsWith('image/')).slice(0, remaining);
  const output = [];
  for (const file of files) output.push(await compressAsset(file));
  return output;
}

async function saveAssets(supabase, taskId, assets, { replace = false } = {}) {
  if (!assets.length) return [];
  if (replace) {
    const { error } = await supabase.from('uat_design_assets').delete().eq('task_id', taskId);
    if (error) throw error;
  }
  const rows = assets.map((asset, index) => ({
    task_id: taskId,
    file_name: asset.file_name,
    data_url: asset.data_url,
    asset_role: String(asset.asset_role || '必用元素'),
    note: String(asset.note || ''),
    sort_order: Number.isInteger(asset.sort_order) ? asset.sort_order : index,
  }));
  const { data, error } = await supabase.from('uat_design_assets').insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

function renderCreateAssets() {
  const grid = document.getElementById('required-assets-create-grid');
  const count = document.getElementById('required-assets-create-count');
  const empty = document.getElementById('required-assets-create-empty');
  if (!grid) return;
  if (count) count.textContent = `${createAssets.length}/${MAX_ASSETS}`;
  if (empty) empty.classList.toggle('hidden', createAssets.length > 0);
  grid.innerHTML = createAssets.map((asset, index) => `
    <div class="rounded-2xl border border-orange-500/20 bg-[#09090b] overflow-hidden">
      <div class="aspect-[4/3] bg-black/30 relative overflow-hidden">
        <img src="${asset.data_url}" class="w-full h-full object-contain" alt="必用素材">
        <button type="button" data-remove-required-asset="${index}" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-rose-600">×</button>
        <span class="absolute left-2 top-2 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-500 text-black">必用素材</span>
      </div>
      <div class="p-3 space-y-2">
        <p class="text-[11px] text-zinc-400 truncate">${esc(asset.file_name)}</p>
        <input data-role-required-asset="${index}" value="${esc(asset.asset_role)}" class="w-full bg-black/30 border border-orange-500/20 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:border-orange-400" placeholder="它是什么？例如：TIG IP / WeBank Logo / 人物照片">
        <input data-note-required-asset="${index}" value="${esc(asset.note)}" class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:border-orange-400" placeholder="使用要求，例如：必须原样使用 / 放右下角">
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('[data-remove-required-asset]').forEach(button => button.onclick = () => {
    createAssets.splice(Number(button.dataset.removeRequiredAsset), 1);
    createAssets.forEach((item, idx) => item.sort_order = idx);
    renderCreateAssets();
  });
  grid.querySelectorAll('[data-role-required-asset]').forEach(input => input.oninput = () => {
    createAssets[Number(input.dataset.roleRequiredAsset)].asset_role = input.value;
  });
  grid.querySelectorAll('[data-note-required-asset]').forEach(input => input.oninput = () => {
    createAssets[Number(input.dataset.noteRequiredAsset)].note = input.value;
  });
}

async function installCreatePanel(supabase) {
  if (document.getElementById('required-assets-create-panel')) return;
  for (let attempt = 0; attempt < 80 && !document.getElementById('real-file-upload'); attempt += 1) await sleep(50);
  const genericUpload = document.getElementById('real-file-upload');
  const anchor = genericUpload?.closest('.grid');
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', `
    <section id="required-assets-create-panel" class="rounded-2xl border border-orange-500/25 bg-orange-500/[0.05] p-5">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="flex items-center gap-2"><span class="text-[13px] font-bold text-white">🧩 必用设计素材</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">与风格参考分开</span></div>
          <p class="text-[11px] text-zinc-500 mt-1.5">上传必须出现在设计里的公司IP、Logo、人物照片、主视觉、产品图或品牌元素。它们不是“风格参考”，系统会尽量保留素材本体，不允许模型自行想象。</p>
        </div>
        <span id="required-assets-create-count" class="text-xs text-orange-300 font-mono">0/${MAX_ASSETS}</span>
      </div>
      <label class="h-20 rounded-xl border border-dashed border-orange-500/35 bg-black/20 hover:bg-orange-500/10 cursor-pointer flex items-center justify-center text-center transition-colors">
        <div><p class="text-sm font-bold text-orange-300">＋ 添加必用素材</p><p class="text-[10px] text-zinc-600 mt-1">建议透明PNG；可上传IP / Logo / 人物 / 主视觉</p></div>
        <input id="required-assets-create-input" type="file" multiple accept="image/*" class="hidden">
      </label>
      <div id="required-assets-create-empty" class="text-center text-[11px] text-zinc-600 mt-4">如果需求写了“使用我们自己的IP/Logo/人物”，请务必在这里上传，不能只在文字里写名字。</div>
      <div id="required-assets-create-grid" class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4"></div>
    </section>
  `);
  document.getElementById('required-assets-create-input').onchange = async (event) => {
    try {
      const added = await compressFiles(event.target.files, MAX_ASSETS - createAssets.length);
      createAssets.push(...added);
      createAssets.forEach((item, idx) => item.sort_order = idx);
      renderCreateAssets();
    } catch (error) { notify('必用素材处理失败', error.message, 'error'); }
    event.target.value = '';
  };

  for (let attempt = 0; attempt < 100 && typeof window.submitNewReq !== 'function'; attempt += 1) await sleep(50);
  if (typeof window.submitNewReq !== 'function' || window.submitNewReq.__requiredAssetsWrapped) return;
  if (typeof window.openModal === 'function') {
    const originalOpenModal = window.openModal;
    window.openModal = function(modalId, isEdit = false) {
      if (modalId === 'create-modal' && !isEdit) {
        createAssets = [];
        renderCreateAssets();
      }
      return originalOpenModal.apply(this, arguments);
    };
  }
  const originalSubmit = window.submitNewReq;
  const wrapped = async function() {
    const assignee = document.getElementById('req-assignee')?.value || 'none';
    const title = document.getElementById('req-short-title')?.value.trim() || '';
    const user = JSON.parse(localStorage.getItem('activeUserObj') || '{}');
    const creator = user.displayName || user.cnName || user.enName || '';
    const missingRoles = createAssets.filter(item => !String(item.asset_role || '').trim());
    if (assignee === 'davis.design.ai' && missingRoles.length) {
      if (window.showAlert) window.showAlert('请说明素材是什么', '每张必用素材都需要标明身份，例如“TIG IP”“WeBank Logo”“讲师照片”。AI 才知道它必须如何使用。', 'info');
      return;
    }
    await originalSubmit.apply(this, arguments);
    if (!title || assignee !== 'davis.design.ai' || !createAssets.length) return;
    const { data: rows } = await supabase.from('test_tasks').select('id').eq('title', title).eq('creator', creator).eq('assignee', assignee).order('created_at', { ascending: false }).limit(1);
    const taskId = rows?.[0]?.id;
    if (!taskId) return;
    await saveAssets(supabase, taskId, createAssets, { replace: true });
  };
  wrapped.__requiredAssetsWrapped = true;
  window.submitNewReq = wrapped;
}

function assetCard(asset, interactive = false) {
  return `<div class="rounded-xl overflow-hidden border border-orange-500/20 bg-black/20"><div class="aspect-[4/3] bg-black/40 relative"><img src="${asset.data_url}" class="w-full h-full object-contain" alt="必用素材"><span class="absolute left-2 top-2 text-[10px] font-bold bg-orange-500 text-black px-2 py-1 rounded-full">${esc(asset.asset_role || '必用素材')}</span></div><div class="p-3"><p class="text-[11px] text-zinc-300 truncate">${esc(asset.file_name)}</p><p class="text-[10px] text-zinc-500 mt-1">${esc(asset.note || '系统将保留素材本体')}</p>${interactive ? `<button data-delete-design-asset="${asset.id}" class="mt-2 w-full text-[10px] px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20">删除素材</button>` : ''}</div></div>`;
}

async function installRequesterDetailPanel(supabase) {
  let panel = document.getElementById('required-assets-detail-panel');
  const aiPanel = document.getElementById('ai-requirement-panel');
  if (!panel && !aiPanel) return;
  const taskId = new URLSearchParams(location.search).get('id');
  if (!taskId) return;
  if (!panel) aiPanel.insertAdjacentHTML('beforebegin', `
    <section id="required-assets-detail-panel" class="bg-[#121217] border border-orange-500/20 rounded-2xl p-7 relative overflow-hidden">
      <div class="flex justify-between gap-4 items-start mb-5"><div><h3 class="text-sm font-bold text-white">🧩 必用设计素材</h3><p class="text-[11px] text-zinc-500 mt-1">这里放必须真实出现在设计中的IP、Logo、人物、主视觉等。风格参考只学风格，这里的素材才是“要用进去的东西”。</p></div><span id="required-assets-detail-count" class="text-xs text-orange-300"></span></div>
      <div id="required-assets-detail-grid" class="grid grid-cols-2 lg:grid-cols-3 gap-3"></div>
      <div class="mt-4 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/[0.04] p-4">
        <label class="cursor-pointer block text-center"><span class="text-xs font-bold text-orange-300">＋ 添加必用素材</span><input id="required-assets-detail-input" type="file" multiple accept="image/*" class="hidden"></label>
        <div id="required-assets-pending-grid" class="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3"></div>
        <button id="required-assets-detail-save" class="hidden mt-3 w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold">保存素材并让 AI 重新理解</button>
      </div>
    </section>
  `);
  panel = document.getElementById('required-assets-detail-panel');
  let pending = [];

  const renderPending = () => {
    const grid = document.getElementById('required-assets-pending-grid');
    const save = document.getElementById('required-assets-detail-save');
    if (!grid) return;
    grid.innerHTML = pending.map((asset, index) => `<div class="rounded-xl border border-orange-500/20 overflow-hidden bg-black/20"><img src="${asset.data_url}" class="w-full aspect-[4/3] object-contain bg-black/30"><div class="p-2 space-y-2"><input data-pending-asset-role="${index}" class="w-full bg-black/30 border border-orange-500/20 rounded-lg px-2 py-1.5 text-[10px] text-white" placeholder="例如：TIG IP / Logo / 人物照片"><input data-pending-asset-note="${index}" class="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" placeholder="使用要求（选填）"></div></div>`).join('');
    save?.classList.toggle('hidden', pending.length === 0);
    grid.querySelectorAll('[data-pending-asset-role]').forEach(input => input.oninput = () => pending[Number(input.dataset.pendingAssetRole)].asset_role = input.value);
    grid.querySelectorAll('[data-pending-asset-note]').forEach(input => input.oninput = () => pending[Number(input.dataset.pendingAssetNote)].note = input.value);
  };

  const refresh = async () => {
    const { data: assets, error } = await supabase.from('uat_design_assets').select('*').eq('task_id', taskId).order('sort_order', { ascending: true });
    if (error) return;
    const list = assets || [];
    const grid = document.getElementById('required-assets-detail-grid');
    const count = document.getElementById('required-assets-detail-count');
    if (count) count.textContent = `${list.length}/${MAX_ASSETS} 张`;
    if (grid) grid.innerHTML = list.length ? list.map(asset => assetCard(asset, true)).join('') : '<div class="col-span-full text-center py-6 rounded-xl bg-black/20 border border-dashed border-white/10 text-xs text-zinc-500">尚未上传必用素材。如果需求明确写了“使用自己的IP/Logo/人物”，AI 应在这里等待素材，而不是自行编造。</div>';
    grid?.querySelectorAll('[data-delete-design-asset]').forEach(button => button.onclick = async () => {
      await supabase.from('uat_design_assets').delete().eq('id', button.dataset.deleteDesignAsset).eq('task_id', taskId);
      await refresh();
    });
  };

  document.getElementById('required-assets-detail-input').onchange = async (event) => {
    const { data: existing } = await supabase.from('uat_design_assets').select('id').eq('task_id', taskId);
    try {
      pending = await compressFiles(event.target.files, MAX_ASSETS - (existing?.length || 0));
      pending.forEach((item, idx) => item.sort_order = (existing?.length || 0) + idx);
      renderPending();
    } catch (error) { notify('必用素材处理失败', error.message, 'error'); }
    event.target.value = '';
  };

  document.getElementById('required-assets-detail-save').onclick = async () => {
    if (!pending.length) return;
    if (pending.some(item => !String(item.asset_role || '').trim())) {
      notify('请标明素材身份', '例如：TIG IP / WeBank Logo / 人物照片。', 'error');
      return;
    }
    try {
      await saveAssets(supabase, taskId, pending);
      pending = [];
      renderPending();
      await refresh();
      await startAutomaticAnalysis(supabase, taskId);
      notify('必用素材已交给 AI', 'AI 会重新理解需求，并在下一版设计中使用这些素材。', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (error) { notify('素材保存失败', error.message, 'error'); }
  };
  await refresh();
}

async function installAiWorkspacePanel(supabase) {
  if (window.__davisRequiredAssetsWorkspaceStarted) return;
  window.__davisRequiredAssetsWorkspaceStarted = true;
  let rendering = false;
  const render = async () => {
    if (rendering) return;
    rendering = true;
    try {
      const active = document.querySelector('.task.active');
      const taskId = active?.dataset?.id;
      const detail = document.getElementById('detail');
      if (!taskId || !detail) return;
      const old = document.getElementById('ai-required-assets-panel');
      if (old?.dataset.taskId === taskId) return;
      old?.remove();
      const { data: assets } = await supabase.from('uat_design_assets').select('*').eq('task_id', taskId).order('sort_order', { ascending: true });
      const list = assets || [];
      const panel = document.createElement('div');
      panel.id = 'ai-required-assets-panel';
      panel.dataset.taskId = taskId;
      panel.className = 'mt-5 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-5';
      panel.innerHTML = `<div class="flex justify-between gap-3 mb-4"><div><p class="text-sm font-bold text-white">🧩 必用设计素材</p><p class="text-xs text-slate-500 mt-1">这些是内容资产，不是风格参考。IP / Logo / 人物不能由模型自行想象。</p></div><span class="text-xs text-orange-300">${list.length} 张</span></div><div class="grid grid-cols-2 md:grid-cols-3 gap-3">${list.length ? list.map(asset => assetCard(asset, false)).join('') : '<div class="col-span-full text-xs text-slate-500 py-4">当前没有必用素材。</div>'}</div>`;
      detail.appendChild(panel);
    } finally { rendering = false; }
  };
  const observer = new MutationObserver(() => render());
  observer.observe(document.body, { childList: true, subtree: true });
  await render();
}

export async function bootstrapRequiredDesignAssetsUI(supabase) {
  const path = location.pathname.split('/').pop() || '';
  if (path === 'index.html' || path === '' || path.endsWith('/')) await installCreatePanel(supabase);
  if (path === 'task-detail-requester.html') await installRequesterDetailPanel(supabase);
  if (path === 'ai-designer-workspace.html') await installAiWorkspacePanel(supabase);
}
