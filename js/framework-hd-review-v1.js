import { getDrivePreviewObjectUrl } from './seedream-drive-preview-client.mjs?v=drive-preview-v7';

let supabaseClient = null;
let pageUrls = [];
let pageIndex = 0;
let overlay = null;
let observer = null;
let refreshTimer = null;
let lastKey = '';

const pageName = () => location.pathname.split('/').pop() || '';
const taskId = () => String(new URLSearchParams(location.search).get('id') || '').trim();
const parseHistory = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(String(raw || '[]')); } catch { return []; }
};

function latestFramework(history) {
  return [...history].reverse().find(item => item?.action === 'submit_framework' && Array.isArray(item?.drive_file_ids) && item.drive_file_ids.length >= 1) || null;
}

function ensureOverlay() {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'framework-hd-review-overlay';
  overlay.className = 'fixed inset-0 z-[1000000] hidden bg-black/95 backdrop-blur-md';
  overlay.innerHTML = `
    <div class="absolute inset-0 flex flex-col">
      <div class="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-black/40">
        <div>
          <div class="text-white font-bold text-base">框架方案 · 高清审核</div>
          <div id="framework-hd-review-count" class="text-xs text-zinc-400 mt-1">P1 / 3</div>
        </div>
        <div class="flex items-center gap-2">
          <button id="framework-hd-review-prev" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">← 上一页</button>
          <button id="framework-hd-review-next" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">下一页 →</button>
          <button id="framework-hd-review-close" class="ml-3 w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500 text-white text-xl">×</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 overflow-auto flex items-center justify-center p-6">
        <img id="framework-hd-review-image" alt="框架方案高清原图" class="max-w-none max-h-none object-contain shadow-2xl rounded-lg" style="width:auto;height:auto;min-width:min(92vw,1242px);" />
      </div>
      <div id="framework-hd-review-strip" class="h-28 shrink-0 border-t border-white/10 bg-black/50 flex items-center justify-center gap-3 px-6"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#framework-hd-review-close')?.addEventListener('click', closeHdReview);
  overlay.querySelector('#framework-hd-review-prev')?.addEventListener('click', () => showPage((pageIndex - 1 + pageUrls.length) % pageUrls.length));
  overlay.querySelector('#framework-hd-review-next')?.addEventListener('click', () => showPage((pageIndex + 1) % pageUrls.length));
  overlay.addEventListener('click', event => { if (event.target === overlay) closeHdReview(); });
  window.addEventListener('keydown', event => {
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (event.key === 'Escape') closeHdReview();
    if (event.key === 'ArrowLeft') showPage((pageIndex - 1 + pageUrls.length) % pageUrls.length);
    if (event.key === 'ArrowRight') showPage((pageIndex + 1) % pageUrls.length);
  });
  return overlay;
}

function renderStrip() {
  const strip = ensureOverlay().querySelector('#framework-hd-review-strip');
  if (!strip) return;
  strip.innerHTML = pageUrls.map((url, idx) => `
    <button data-hd-page="${idx}" class="h-20 w-16 rounded-lg border ${idx === pageIndex ? 'border-sky-400 ring-2 ring-sky-400/30' : 'border-white/10'} overflow-hidden bg-zinc-900 shrink-0">
      <img src="${url}" alt="P${idx + 1}" class="w-full h-full object-contain" />
    </button>`).join('');
  strip.querySelectorAll('[data-hd-page]').forEach(button => button.addEventListener('click', () => showPage(Number(button.dataset.hdPage || 0))));
}

function showPage(index) {
  if (!pageUrls.length) return;
  pageIndex = Math.max(0, Math.min(index, pageUrls.length - 1));
  const root = ensureOverlay();
  const image = root.querySelector('#framework-hd-review-image');
  const count = root.querySelector('#framework-hd-review-count');
  if (image) image.src = pageUrls[pageIndex];
  if (count) count.textContent = `P${pageIndex + 1} / ${pageUrls.length} · Google Drive 原始高清图`;
  renderStrip();
}

function openHdReview(startIndex = 0) {
  if (!pageUrls.length) return;
  const root = ensureOverlay();
  root.classList.remove('hidden');
  document.documentElement.style.overflow = 'hidden';
  showPage(startIndex);
}

function closeHdReview() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  document.documentElement.style.overflow = '';
}

function patchHistoryCard(framework) {
  const container = document.getElementById('version-history-container');
  if (!container || !pageUrls.length) return false;
  const cards = [...container.children];
  const version = String(framework.version || 'v-X');
  const card = cards.find(node => String(node.textContent || '').includes('框架方案') && String(node.textContent || '').includes(version)) || cards.find(node => String(node.textContent || '').includes('框架方案'));
  if (!card) return false;
  const preview = [...card.children].find(node => node.classList?.contains('w-[280px]'));
  if (!preview) return false;
  preview.className = 'w-[420px] min-h-[330px] bg-[#09090b] rounded-xl border border-sky-500/20 overflow-hidden relative shadow-inner p-3 flex flex-col shrink-0';
  preview.removeAttribute('onclick');
  preview.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="text-xs font-bold text-white">3 页高清框架方案</div>
      <div class="text-[10px] text-emerald-400">Google Drive 原图</div>
    </div>
    <div class="grid grid-cols-3 gap-2 flex-1 min-h-0">
      ${pageUrls.map((url, idx) => `
        <button data-framework-hd-page="${idx}" class="rounded-lg overflow-hidden border border-white/10 bg-black hover:border-sky-400 transition-colors min-h-[245px]">
          <img src="${url}" alt="P${idx + 1}" class="w-full h-full object-contain" />
        </button>`).join('')}
    </div>
    <button data-framework-hd-open class="mt-3 w-full py-2.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-300 hover:bg-sky-500/25 text-xs font-bold">查看 3 页高清原图</button>`;
  preview.querySelectorAll('[data-framework-hd-page]').forEach(button => button.addEventListener('click', () => openHdReview(Number(button.dataset.frameworkHdPage || 0))));
  preview.querySelector('[data-framework-hd-open]')?.addEventListener('click', () => openHdReview(0));
  return true;
}

async function sync() {
  if (!supabaseClient || pageName() !== 'task-detail-requester.html') return;
  const id = taskId();
  if (!id) return;
  try {
    const { data: task, error } = await supabaseClient.from('test_tasks').select('id,status,history_json').eq('id', id).single();
    if (error || !task) return;
    const framework = latestFramework(parseHistory(task.history_json));
    if (!framework) return;
    const ids = framework.drive_file_ids.map(String).filter(Boolean).slice(0, 3);
    const key = `${framework.version || ''}:${ids.join(',')}`;
    if (key !== lastKey || pageUrls.length !== ids.length) {
      pageUrls = await Promise.all(ids.map(fileId => getDrivePreviewObjectUrl(supabaseClient, fileId)));
      lastKey = key;
    }
    patchHistoryCard(framework);
  } catch (error) {
    console.error('高清框架审核视图加载失败:', error);
  }
}

export function bootstrapFrameworkHdReview(client) {
  if (typeof window === 'undefined' || pageName() !== 'task-detail-requester.html') return;
  if (window.__frameworkHdReviewV1) return;
  window.__frameworkHdReviewV1 = true;
  supabaseClient = client;
  const start = () => {
    sync();
    observer = new MutationObserver(() => { clearTimeout(refreshTimer); refreshTimer = setTimeout(sync, 120); });
    const container = document.getElementById('version-history-container');
    if (container) observer.observe(container, { childList: true, subtree: false });
    window.addEventListener('framework-preview-ready', sync);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('beforeunload', () => observer?.disconnect(), { once: true });
}
