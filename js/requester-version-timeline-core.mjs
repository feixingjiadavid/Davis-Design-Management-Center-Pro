const DELIVERED_REVISION_STATUSES = new Set(['ready_for_review', 'superseded', 'accepted']);

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function parseHistory(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function latestFrameworkSubmission(history) {
  return [...history].reverse().find((item) => item?.action === 'submit_framework') || null;
}

function normalizePages(pages = []) {
  return (Array.isArray(pages) ? pages : [])
    .map((page, index) => ({
      pageIndex: Math.max(1, Number(page?.page_index || index + 1)),
      fileId: String(page?.drive_file_id || '').trim(),
    }))
    .filter((page) => page.fileId)
    .sort((left, right) => left.pageIndex - right.pageIndex);
}

function submissionPages(submission) {
  const ids = Array.isArray(submission?.drive_file_ids) ? submission.drive_file_ids : [];
  return normalizePages(ids.map((fileId, index) => ({ page_index: index + 1, drive_file_id: fileId })));
}

function approvalStage(task, template, history) {
  if (template?.id) {
    const detail = [template.approved_by_label, template.approval_note].map((value) => String(value || '').trim()).filter(Boolean).join(' · ');
    return {
      kind: 'approval',
      label: '领导审核状态',
      statusText: '已通过并锁定母版',
      tone: 'approved',
      detail,
      pages: [],
    };
  }
  const rejected = [...history].reverse().find((item) => item?.action === 'reject_framework' || item?.is_rejected === true);
  if (rejected) {
    return {
      kind: 'approval',
      label: '领导审核状态',
      statusText: '已驳回，等待调整',
      tone: 'rejected',
      detail: String(rejected.reply || rejected.desc || '').trim(),
      pages: [],
    };
  }
  return {
    kind: 'approval',
    label: '领导审核状态',
    statusText: String(task?.status) === 'pending_approval' ? '待领导审核' : '尚未提交审核',
    tone: 'pending',
    detail: '',
    pages: [],
  };
}

export function buildRequesterVersionTimeline({ task = {}, template = null, revisions = [] } = {}) {
  const history = parseHistory(task.history_json);
  const submission = latestFrameworkSubmission(history);
  const demoPages = normalizePages(template?.pages?.length ? template.pages : submissionPages(submission));
  const stages = [];

  if (submission || template) {
    stages.push({
      kind: 'demo',
      label: 'Demo 框架版',
      version: String(template?.framework_version || submission?.version || '').trim(),
      pages: demoPages,
    });
    stages.push(approvalStage(task, template, history));
  }

  const allDelivered = (Array.isArray(revisions) ? revisions : [])
    .filter((revision) => DELIVERED_REVISION_STATUSES.has(String(revision?.status)))
    .filter((revision) => Number(revision?.revision_no) >= 1)
    .sort((left, right) => Number(left.revision_no) - Number(right.revision_no));
  const displayedRevisions = allDelivered.filter((revision) => Number(revision.revision_no) <= 2);

  for (const revision of displayedRevisions) {
    const revisionNo = Number(revision.revision_no);
    stages.push({
      kind: 'revision',
      label: `第 ${revisionNo} 次修改版`,
      revisionNo,
      pages: normalizePages(revision.page_manifest),
    });
  }

  if (template?.id) {
    const latest = allDelivered.at(-1) || null;
    stages.push({
      kind: 'current',
      label: '当前版本',
      sourceLabel: latest ? `第 ${Number(latest.revision_no)} 次修改版` : '已锁定 Demo 框架版',
      pages: latest ? normalizePages(latest.page_manifest) : normalizePages(template.pages),
    });
  }

  return stages;
}

function statusMarkup(stage) {
  if (!stage.statusText) return '';
  const classes = stage.tone === 'rejected'
    ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
    : stage.tone === 'pending'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  return `<span class="px-2.5 py-1 rounded-full border ${classes} text-xs">${esc(stage.statusText)}</span>`;
}

function pagesMarkup(stage) {
  if (!stage.pages?.length) return '';
  return `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">${stage.pages.map((page) => `
    <article class="rounded-xl overflow-hidden border border-white/10 bg-[#0d1220]" data-requester-version-page="${page.pageIndex}">
      <div class="px-3 py-2 text-[11px] font-bold text-white">P${page.pageIndex}</div>
      <div data-version-preview-file="${esc(page.fileId)}" class="min-h-[260px] flex items-center justify-center px-4 text-center text-xs text-zinc-500">图片加载中…</div>
      <div class="px-3 py-2 border-t border-white/10 text-[10px] text-zinc-500">点击图片查看大图</div>
    </article>`).join('')}</div>`;
}

export function renderRequesterVersionTimelineMarkup(stages = []) {
  if (!stages.length) return '<div class="py-10 text-center text-sm text-zinc-500">正式设计版本尚未交付。</div>';
  return `<div class="space-y-5">${stages.map((stage, index) => `
    <section class="relative rounded-2xl border ${stage.kind === 'current' ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/10 bg-white/[0.025]'} p-5" data-requester-version-stage="${esc(stage.kind)}">
      ${index < stages.length - 1 ? '<div class="absolute left-8 -bottom-5 h-5 w-px bg-white/15"></div>' : ''}
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h4 class="text-sm font-bold text-white">${esc(stage.label)}</h4>${stage.version ? `<p class="mt-1 text-[11px] text-zinc-500">版本 ${esc(stage.version)}</p>` : ''}${stage.sourceLabel ? `<p class="mt-1 text-[11px] text-zinc-500">当前采用：${esc(stage.sourceLabel)}</p>` : ''}</div>
        ${statusMarkup(stage)}
      </div>
      ${stage.detail ? `<p class="mt-3 text-xs leading-relaxed text-zinc-400">${esc(stage.detail)}</p>` : ''}
      ${pagesMarkup(stage)}
    </section>`).join('')}</div>`;
}
