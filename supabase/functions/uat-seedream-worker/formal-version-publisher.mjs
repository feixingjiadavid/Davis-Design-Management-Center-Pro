const READY_STATUSES = new Set(['ready', 'confirmed']);
const PUBLIC_DESIGNS_MARKER = '/storage/v1/object/public/designs/';

function safeSegment(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function imageExtension(value) {
  const extension = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (extension === 'jpeg' || extension === 'jpg') return 'jpg';
  if (extension === 'webp') return 'webp';
  if (extension === 'gif') return 'gif';
  return 'png';
}

export function formalAssetStoragePath({ taskId, generationId, pageIndex, extension }) {
  return `formal-deliveries/${safeSegment(taskId)}/${safeSegment(generationId)}/p-${Math.max(1, Number(pageIndex) || 1)}.${imageExtension(extension)}`;
}

function isFormalAssetUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) && url.includes(PUBLIC_DESIGNS_MARKER);
}

function orderedAssets(rows, baseAssets = []) {
  const expected = Math.max(
    ...rows.map((row) => Number(row?.page_count || 0)),
    ...baseAssets.map((asset) => Number(asset?.sort_order || 0)),
    0,
  );
  if (!expected || !rows.length) return null;
  const byPage = new Map();
  for (const asset of baseAssets) {
    const sortOrder = Number(asset?.sort_order || 0);
    const assetUrl = String(asset?.asset_url || '').trim();
    if (sortOrder < 1 || sortOrder > expected || byPage.has(sortOrder) || !isFormalAssetUrl(assetUrl)) return null;
    byPage.set(sortOrder, assetUrl);
  }
  const changedPages = new Set();
  for (const row of rows) {
    const pageIndex = Number(row?.page_index || 0);
    const assetUrl = String(row?.output?.formal_asset_url || '').trim();
    if (!READY_STATUSES.has(String(row?.status || '')) || pageIndex < 1 || pageIndex > expected || changedPages.has(pageIndex) || !isFormalAssetUrl(assetUrl)) return null;
    changedPages.add(pageIndex);
    byPage.set(pageIndex, assetUrl);
  }
  if (byPage.size !== expected) return null;
  for (let page = 1; page <= expected; page += 1) if (!byPage.has(page)) return null;

  return [...byPage.entries()].sort(([left], [right]) => left - right).map(([sort_order, asset_url]) => ({
    asset_url,
    asset_type: 'image',
    sort_order,
  }));
}

export function buildFormalVersionPublication({ taskId, mode, revisionNo = 0, description = '', creator = 'Davis AI设计师', rows = [], baseAssets = [] }) {
  const assets = orderedAssets(Array.isArray(rows) ? rows : [], Array.isArray(baseAssets) ? baseAssets : []);
  if (!String(taskId || '').trim() || !assets) return null;

  if (mode === 'initial_framework' || mode === 'framework' || mode === 'framework_revision') {
    return {
      version: {
        task_id: String(taskId),
        version_no: 1,
        version_name: '框架方案',
        version_type: 'framework',
        status: 'pending_review',
        description: String(description || 'AI 设计师已完成框架方案，提交领导审核。'),
        creator: String(creator || 'Davis AI设计师'),
      },
      assets,
    };
  }

  if (mode === 'content_revision') {
    const number = Math.max(1, Number(revisionNo) || 1);
    const revisionName = number === 1 ? '第一次修改' : (number === 2 ? '第二次修改' : `第${number}次修改`);
    return {
      version: {
        task_id: String(taskId),
        version_no: number + 1,
        version_name: revisionName,
        version_type: 'revision',
        status: 'pending_review',
        description: String(description || `完成第${number}次修改，提交需求方审核。`),
        creator: String(creator || 'Davis AI设计师'),
      },
      assets,
    };
  }

  return null;
}
