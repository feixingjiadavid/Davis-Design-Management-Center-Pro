import { composeBrandedSvg } from './brand-composer.mjs';
import { runViCheck } from './vi-check.mjs';

function safeSegment(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function safeExtension(value) {
  const extension = String(value || '').toLowerCase().replace(/^\./, '');
  return ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extension) ? extension.replace('jpeg', 'jpg') : 'bin';
}

export function stageStoragePath({ taskId, generationId, pageIndex, stage, sha256, extension }) {
  const file = `${String(sha256 || '').toLowerCase()}.${safeExtension(extension)}`;
  const page = `p-${Math.max(1, Number(pageIndex) || 1)}`;
  if (stage === 'branded_output') return `formal-deliveries/${safeSegment(taskId)}/${safeSegment(generationId)}/${page}/${file}`;
  if (!['raw_creative', 'composer_preview'].includes(stage)) throw new Error('GENERATION_ASSET_STAGE_INVALID');
  return `${safeSegment(taskId)}/${safeSegment(generationId)}/${page}/${stage}/${file}`;
}

function stableErrorCode(error) {
  const message = error instanceof Error ? error.message : String(error || 'COMPOSITION_FAILED');
  return message.split(':')[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase() || 'COMPOSITION_FAILED';
}

export async function buildCompositionArtifacts({ pageNo, brandPlan, rawCreative, brandAssets = [], templateLayer = null } = {}) {
  if (!brandPlan?.publishable) {
    return {
      passed: false,
      errorCode: brandPlan?.blockReason || 'BRAND_RELEASE_BLOCKED',
      preview: null,
      brandedOutput: null,
      manifest: {},
      viCheck: { passed: false, summary: { logo: 'FAIL', position: 'FAIL', color: 'FAIL' }, checks: [] },
    };
  }
  try {
    const composed = await composeBrandedSvg({ pageNo, pageRule: brandPlan.pageRule, rawCreative, brandAssets, templateLayer });
    const viCheck = runViCheck({
      pageNo,
      pageRule: brandPlan.pageRule,
      manifest: composed.manifest,
      brandAssets,
      outputSha256: composed.contentSha256,
      template: templateLayer,
    });
    const preview = {
      asset_role: 'composer_preview',
      storage_bucket: 'ai-generation-assets',
      mime_type: 'image/svg+xml',
      width: Number(brandPlan.pageRule.canvas.width),
      height: Number(brandPlan.pageRule.canvas.height),
      content_sha256: composed.contentSha256,
      content: composed.svg,
      metadata: { source: 'composer_preview', manifest: composed.manifest },
    };
    if (!viCheck.passed) {
      return { passed: false, errorCode: 'VI_CHECK_FAILED', preview, brandedOutput: null, manifest: composed.manifest, viCheck };
    }
    return {
      passed: true,
      errorCode: null,
      preview,
      brandedOutput: {
        asset_role: 'branded_output',
        storage_bucket: 'designs',
        mime_type: 'image/svg+xml',
        width: preview.width,
        height: preview.height,
        content_sha256: composed.contentSha256,
        content: composed.svg,
        metadata: { source: 'branded_output', manifest: composed.manifest, vi_check: viCheck },
      },
      manifest: composed.manifest,
      viCheck,
    };
  } catch (error) {
    return {
      passed: false,
      errorCode: stableErrorCode(error),
      preview: null,
      brandedOutput: null,
      manifest: {},
      viCheck: { passed: false, summary: { logo: 'FAIL', position: 'FAIL', color: 'FAIL' }, checks: [], error: error instanceof Error ? error.message : String(error) },
    };
  }
}
