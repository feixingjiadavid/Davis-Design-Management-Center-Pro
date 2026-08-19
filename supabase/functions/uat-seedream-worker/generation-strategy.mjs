export function generationMode(row = {}) {
  return String(row.generation_mode || 'initial_framework');
}

const urls = (rows = []) => rows.map((item) => String(item?.data_url || '')).filter(Boolean);

export function resolveGenerationStrategy({ row = {}, templatePage = null, styleReferences = [], assets = [], adjustment = null } = {}) {
  const mode = generationMode(row);
  if (mode === 'content_revision') {
    const anchor = String(templatePage?.drive_preview_data_url || '').trim();
    if (!anchor) throw new Error('APPROVED_TEMPLATE_PAGE_IMAGE_REQUIRED');
    return {
      mode,
      promptKind: 'template_revision',
      images: [anchor, ...urls(assets), ...urls(styleReferences)],
      completionTarget: 'reviewing',
      promptVersion: 'seedream-template-revision-v1',
    };
  }
  if (mode === 'framework_revision') {
    return {
      mode,
      promptKind: 'creative_framework_revision',
      images: [...urls(styleReferences), ...urls(assets)],
      completionTarget: 'pending_approval',
      promptVersion: 'seedream-demo-creative-director-v2',
      adjustment,
    };
  }
  return {
    mode: 'initial_framework',
    promptKind: 'creative_initial',
    images: [...urls(styleReferences), ...urls(assets)],
    completionTarget: 'pending_approval',
    promptVersion: 'seedream-demo-creative-director-v2',
  };
}
