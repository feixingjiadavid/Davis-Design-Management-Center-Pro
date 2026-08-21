let sb = null;
let timer = null;
let syncing = false;
let lastTaskId = '';
let lastSnapshot = '';

const STATUS_COPY = {
  draft: '草稿',
  pending_review: '待审核',
  revision: '修改中',
  accepted: '已通过 / 已验收',
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[ch]));

const pageName = () => location.pathname.split('/').pop() || '';

function currentTaskId() {
  return String(document.querySelector('#taskList .task.active')?.dataset?.id || '').trim();
}

export function buildDesignHistory(versions, assets) {
  const assetsByVersion = new Map();
  for (const asset of assets || []) {
    const list = assetsByVersion.get(asset.design_version_id) || [];
    list.push(asset);
    assetsByVersion.set(asset.design_version_id, list);
  }
  return [...(versions || [])]
    .sort((a, b) => {
      const byCreatedAt = Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0);
      return byCreatedAt || Number(b.version_no || 0) - Number(a.version_no || 0);
    })
    .map((version) => ({
      ...version,
      assets:(assetsByVersion.get(version.id) || [])
        .filter((asset) => String(asset.asset_url || '').trim())
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    }));
}

export function renderDesignHistoryHtml(versions) {
  if (!versions.length) {
    return '<div class="py-10 text-center text-sm text-zinc-500">尚未发布设计版本。</div>';
  }
  return versions.map((version, versionIndex) => {
    const images = version.assets.length
      ? version.assets.map((asset, assetIndex) => {
        const pageNo = assetIndex + 1;
        return `<button type="button" data-design-history-preview="${esc(asset.asset_url)}" class="group text-left rounded-xl overflow-hidden border border-white/10 bg-black/25 hover:border-indigo-400/50 transition-colors">
          <div class="aspect-[4/3] bg-black/30"><img src="${esc(asset.asset_url)}" alt="${esc(version.version_name)} P${pageNo}" loading="lazy" decoding="async" class="w-full h-full object-contain"></div>
          <div class="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5"><span class="text-xs font-bold text-white">P${pageNo}</span><span class="text-[10px] text-indigo-300">点击查看高清大图</span></div>
        </button>`;
      }).join('')
      : '<div class="col-span-full py-6 text-center text-xs text-zinc-500">该版本暂无可展示图片。</div>';
    const latest = versionIndex === 0;
    return `<article class="rounded-2xl border ${latest ? 'border-indigo-400/40 bg-indigo-500/[0.06]' : 'border-white/10 bg-white/[0.025]'} p-4" data-design-version="${esc(version.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div><div class="flex items-center gap-2"><h4 class="text-sm font-bold text-white">v${Number(version.version_no)} ${esc(version.version_name)}</h4>${latest ? '<span class="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">最新版本</span>' : ''}</div><p class="text-[11px] text-zinc-500 mt-1">${version.created_at ? esc(new Date(version.created_at).toLocaleString()) : ''}</p></div>
        <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-300">${esc(STATUS_COPY[version.status] || version.status || '未标记')}</span>
      </div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${images}</div>
      ${version.description ? `<p class="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-relaxed text-zinc-400"><span class="font-bold text-zinc-300">修改说明：</span>${esc(version.description)}</p>` : ''}
    </article>`;
  }).join('');
}

export async function loadDesignHistory(client, taskId) {
  const versionsResult = await client.from('design_versions')
    .select('id,task_id,version_no,version_name,version_type,status,description,creator,created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending:false });
  if (versionsResult.error) throw versionsResult.error;
  const versions = versionsResult.data || [];
  if (!versions.length) return [];
  const assetsResult = await client.from('design_version_assets')
    .select('id,design_version_id,asset_url,asset_type,sort_order,created_at')
    .in('design_version_id', versions.map((version) => version.id))
    .order('sort_order', { ascending:true });
  if (assetsResult.error) throw assetsResult.error;
  return buildDesignHistory(versions, assetsResult.data || []);
}

function ensureHost() {
  let host = document.getElementById('design-generation-history');
  if (host) return host;
  const detail = document.getElementById('detail');
  const grid = detail?.parentElement;
  if (!grid) return null;
  host = document.createElement('section');
  host.id = 'design-generation-history';
  host.className = 'glass rounded-2xl p-5 lg:p-7 mt-6';
  grid.insertAdjacentElement('afterend', host);
  return host;
}

function ensurePreviewModal() {
  let modal = document.getElementById('design-history-preview-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'design-history-preview-modal';
  modal.className = 'hidden fixed inset-0 z-[100] bg-black/90 p-4 md:p-8 items-center justify-center';
  modal.innerHTML = '<button type="button" data-design-history-close class="absolute right-5 top-5 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-white">关闭</button><img data-design-history-full-image alt="设计版本高清预览" class="max-w-full max-h-full object-contain">';
  modal.addEventListener('click', (event) => { if (event.target === modal || event.target.closest?.('[data-design-history-close]')) closeDesignHistoryPreview(); });
  document.body.appendChild(modal);
  return modal;
}

export function openDesignHistoryPreview(url) {
  const modal = ensurePreviewModal();
  const image = modal.querySelector('[data-design-history-full-image]');
  image.src = url;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

export function closeDesignHistoryPreview() {
  const modal = document.getElementById('design-history-preview-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  const image = modal.querySelector('[data-design-history-full-image]');
  if (image) image.removeAttribute('src');
  document.body.style.overflow = '';
}

function render(versions, taskId) {
  const host = ensureHost();
  if (!host) return;
  const imageCount = versions.reduce((sum, version) => sum + version.assets.length, 0);
  host.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-4 mb-5"><div><h3 class="text-base font-bold text-white">设计生成历史</h3><p class="text-xs text-zinc-500 mt-1">按正式生成时间展示每一轮完整设计稿，最新版本在顶部。</p></div><span class="text-xs rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">${versions.length} 个版本 · ${imageCount} 张图片</span></div><div class="space-y-5">${renderDesignHistoryHtml(versions)}</div>`;
  host.dataset.taskId = taskId;
  host.querySelectorAll('[data-design-history-preview]').forEach((button) => {
    button.addEventListener('click', () => openDesignHistoryPreview(button.dataset.designHistoryPreview));
  });
}

function snapshot(versions, taskId) {
  return JSON.stringify({ taskId, versions:versions.map((version) => [
    version.id, version.created_at, version.status, version.description,
    version.assets.map((asset) => [asset.id, asset.asset_url, asset.sort_order]),
  ]) });
}

async function sync(force = false) {
  if (!sb || syncing || document.hidden) return;
  const taskId = currentTaskId();
  if (!taskId) return;
  syncing = true;
  try {
    const versions = await loadDesignHistory(sb, taskId);
    const nextSnapshot = snapshot(versions, taskId);
    if (force || nextSnapshot !== lastSnapshot || taskId !== lastTaskId || !document.getElementById('design-generation-history')) {
      lastSnapshot = nextSnapshot;
      lastTaskId = taskId;
      render(versions, taskId);
    }
  } catch (error) {
    console.error('设计生成历史读取失败:', error);
    const host = ensureHost();
    if (host) host.innerHTML = '<div class="text-sm text-rose-300">设计生成历史暂时无法读取，请刷新重试。</div>';
  } finally {
    syncing = false;
  }
}

export function bootstrapAllGenerationResultsV1(client) {
  if (pageName() !== 'ai-designer-workspace.html' || window.__designGenerationHistoryStarted) return;
  window.__designGenerationHistoryStarted = true;
  sb = client;
  const start = () => {
    sync(true);
    timer = setInterval(() => { if (!document.hidden) sync(false); }, 20000);
    document.getElementById('taskList')?.addEventListener('click', (event) => {
      if (!event.target?.closest?.('.task')) return;
      setTimeout(() => sync(true), 250);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(true); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDesignHistoryPreview(); });
  window.addEventListener('beforeunload', () => clearInterval(timer), { once:true });
}

