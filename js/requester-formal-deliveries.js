const STATUS_COPY = {
  draft: '草稿',
  pending_review: '待审核',
  revision: '修改中',
  accepted: '已通过 / 已验收',
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

export function isFormalDeliveryAssetUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.pathname.includes('/storage/v1/object/public/designs/');
  } catch { return false; }
}

export function groupFormalVersions(versions, assets) {
  const byVersion = new Map();
  for (const asset of assets || []) {
    if (!isFormalDeliveryAssetUrl(asset.asset_url)) continue;
    const list = byVersion.get(asset.design_version_id) || [];
    list.push(asset);
    byVersion.set(asset.design_version_id, list);
  }
  return [...(versions || [])]
    .sort((a, b) => Number(b.version_no) - Number(a.version_no))
    .map((version) => ({
      ...version,
      assets: (byVersion.get(version.id) || []).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    }));
}

export async function loadFormalVersions(supabase, taskId) {
  const versionsResult = await supabase
    .from('design_versions')
    .select('id,task_id,version_no,version_name,version_type,status,description,creator,created_at')
    .eq('task_id', taskId)
    .order('version_no', { ascending: false });
  if (versionsResult.error) throw versionsResult.error;
  const versions = versionsResult.data || [];
  if (!versions.length) return [];
  const assetsResult = await supabase
    .from('design_version_assets')
    .select('id,design_version_id,asset_url,asset_type,sort_order,created_at')
    .in('design_version_id', versions.map((item) => item.id))
    .order('sort_order', { ascending: true });
  if (assetsResult.error) throw assetsResult.error;
  return groupFormalVersions(versions, assetsResult.data || []);
}

export function renderFormalVersionsHtml(versions) {
  const latestNo = Math.max(0, ...(versions || []).map((item) => Number(item.version_no) || 0));
  return (versions || []).map((version) => {
    const latest = Number(version.version_no) === latestNo;
    const images = version.assets.length
      ? version.assets.map((asset, index) => `<button type="button" data-formal-preview="${esc(asset.asset_url)}" class="text-left rounded-xl border border-white/10 bg-black/30 overflow-hidden hover:border-indigo-400/50 transition-colors"><div class="aspect-[4/3] bg-black/40"><img src="${esc(asset.asset_url)}" alt="${esc(version.version_name)} P${index + 1}" loading="lazy" class="w-full h-full object-contain"></div><span class="block px-3 py-2 text-[11px] text-indigo-300">点击图片查看大图</span></button>`).join('')
      : '<p class="col-span-full text-xs text-zinc-500 py-4">该版本暂无可展示图片。</p>';
    return `<article class="rounded-2xl border ${latest ? 'border-indigo-400/45 bg-indigo-500/[0.06]' : 'border-white/5 bg-[#16161d]'} p-5">
      <div class="flex items-start justify-between gap-4 mb-4"><div><div class="flex items-center gap-2"><h4 class="text-[15px] font-bold text-white">v${Number(version.version_no)} ${esc(version.version_name)}</h4>${latest ? '<span class="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">当前最新版本</span>' : ''}</div><p class="text-[11px] text-zinc-500 mt-1">${esc(version.creator || '设计师')} · ${new Date(version.created_at).toLocaleString()}</p></div><span class="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-zinc-300">${esc(STATUS_COPY[version.status] || version.status)}</span></div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${images}</div>
      ${version.description ? `<p class="mt-4 rounded-xl bg-black/25 border border-white/5 p-3 text-[12px] leading-relaxed text-zinc-400"><span class="font-bold text-zinc-300">修改说明：</span>${esc(version.description)}</p>` : ''}
    </article>`;
  }).join('');
}

export async function renderFormalDeliveries(supabase, taskId) {
  const block = document.getElementById('version-history-block');
  const container = document.getElementById('version-history-container');
  if (!block || !container || !taskId) return [];
  const versions = await loadFormalVersions(supabase, taskId);
  block.classList.remove('hidden');
  container.innerHTML = versions.length
    ? renderFormalVersionsHtml(versions)
    : '<div class="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">设计师尚未发布正式交付版本。</div>';
  container.querySelectorAll('[data-formal-preview]').forEach((button) => {
    button.addEventListener('click', () => window.openPreview?.(button.dataset.formalPreview));
  });
  return versions;
}

export function bootstrapRequesterFormalDeliveries(supabase) {
  if ((location.pathname.split('/').pop() || '') !== 'task-detail-requester.html') return;
  const taskId = new URLSearchParams(location.search).get('id');
  const start = () => renderFormalDeliveries(supabase, taskId).catch((error) => {
    console.error('正式设计版本读取失败:', error);
    const container = document.getElementById('version-history-container');
    if (container) container.innerHTML = '<p class="text-sm text-rose-300">设计版本暂时无法读取，请刷新页面重试。</p>';
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

