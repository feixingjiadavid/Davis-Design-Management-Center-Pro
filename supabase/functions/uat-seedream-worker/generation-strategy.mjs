export function generationMode(row = {}) {
  return String(row.generation_mode || 'initial_framework');
}

const urls = (rows = []) => rows.map((item) => String(item?.data_url || '')).filter(Boolean);

export function resolveGenerationStrategy({ row = {}, templatePage = null, styleReferences = [], assets = [], adjustment = null, brandPlan = null } = {}) {
  const mode = generationMode(row);
  if (mode === 'content_revision') {
    const anchor = String(templatePage?.drive_preview_data_url || '').trim();
    if (!anchor) throw new Error('APPROVED_TEMPLATE_PAGE_IMAGE_REQUIRED');
    return {
      mode,
      promptKind: 'template_revision',
      // 内容改版是“局部编辑”，不是再次创作。只把已通过母版作为唯一图像输入，
      // 避免风格参考/Logo/IP 素材再次进入模型后被重新解释、改色或变形。
      images: [anchor],
      completionTarget: 'reviewing',
      promptVersion: 'seedream-template-revision-v1',
      creativeArea: brandPlan?.creativeArea || null,
      brandPlan,
    };
  }
  if (mode === 'framework_revision') {
    return {
      mode,
      promptKind: 'creative_framework_revision',
      images: [...urls(styleReferences), ...urls(filterCreativeAssets(assets))],
      completionTarget: 'pending_approval',
      promptVersion: 'seedream-demo-creative-director-v2',
      adjustment,
      creativeArea: brandPlan?.creativeArea || null,
      brandPlan,
    };
  }
  return {
    mode: 'initial_framework',
    promptKind: 'creative_initial',
    images: [...urls(styleReferences), ...urls(filterCreativeAssets(assets))],
    completionTarget: 'pending_approval',
    promptVersion: 'seedream-demo-creative-director-v2',
    creativeArea: brandPlan?.creativeArea || null,
    brandPlan,
  };
}
import { filterCreativeAssets } from './brand-rule-matcher.mjs';
