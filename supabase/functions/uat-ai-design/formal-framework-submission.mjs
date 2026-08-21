const READY = new Set(['ready', 'confirmed']);
const PUBLIC_STORAGE = '/storage/v1/object/public/designs/';

function outputOf(row) {
  if (row?.output && typeof row.output === 'object') return row.output;
  try { return JSON.parse(String(row?.output || '{}')); } catch { return {}; }
}

function groupKey(row) {
  return String(row?.generation_mode) === 'framework_revision'
    ? `revision:${row?.framework_adjustment_id || ''}`
    : `initial:${row?.analysis_id || ''}`;
}

export function selectCompleteFrameworkGenerationGroup(rows, formalAssets) {
  const assetsByPage = new Map((formalAssets || []).map((asset) => [Number(asset.sort_order), String(asset.asset_url || '')]));
  const groups = new Map();
  for (const row of rows || []) {
    if (!READY.has(String(row?.status || ''))) continue;
    if (!['initial_framework', 'framework_revision'].includes(String(row?.generation_mode || ''))) continue;
    const key = groupKey(row);
    if (key.endsWith(':')) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const candidates = [...groups.values()].sort((left, right) => {
    const l = Math.max(...left.map((row) => Date.parse(row.updated_at || row.created_at || 0) || 0));
    const r = Math.max(...right.map((row) => Date.parse(row.updated_at || row.created_at || 0) || 0));
    return r - l;
  });
  for (const group of candidates) {
    const pageCount = Math.max(...group.map((row) => Number(row.page_count) || 0), 0);
    if (!pageCount || group.length !== pageCount || assetsByPage.size !== pageCount) continue;
    const pages = new Set();
    let valid = true;
    for (const row of group) {
      const page = Number(row.page_index);
      const formalUrl = String(outputOf(row).formal_asset_url || '');
      if (page < 1 || page > pageCount || pages.has(page) || !formalUrl.includes(PUBLIC_STORAGE) || assetsByPage.get(page) !== formalUrl) { valid = false; break; }
      pages.add(page);
    }
    if (valid) return [...group].sort((a, b) => Number(a.page_index) - Number(b.page_index));
  }
  return [];
}
