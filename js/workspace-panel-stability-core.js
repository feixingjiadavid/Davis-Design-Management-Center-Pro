function pick(item, keys) {
  const out = {};
  for (const key of keys) out[key] = item?.[key] ?? null;
  return out;
}

export function buildStablePanelSignature({ taskId, task, references = [], assets = [], demos = [], analysis = null }) {
  return JSON.stringify({
    taskId: taskId || '',
    task: pick(task, ['status', 'summary_desc']),
    references: references.map(item => pick(item, ['id', 'updated_at', 'is_primary', 'file_name', 'note', 'sort_order'])),
    assets: assets.map(item => pick(item, ['id', 'updated_at', 'asset_role', 'file_name', 'note', 'sort_order'])),
    demos: demos.map(item => pick(item, ['id', 'page_index', 'page_count', 'status', 'updated_at', 'model'])),
    analysis: analysis ? pick(analysis, ['version', 'status', 'prompt_version']) : null,
  });
}
