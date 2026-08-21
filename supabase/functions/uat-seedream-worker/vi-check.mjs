import { computePlacement } from './brand-composer.mjs';

function sameRect(left, right) {
  return ['x', 'y', 'width', 'height'].every((key) => Number(left?.[key]) === Number(right?.[key]));
}

function intersects(left, right) {
  if (!left || !right) return false;
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function check(code, passed, detail = {}) {
  return { code, passed: Boolean(passed), detail };
}

export function runViCheck({ pageNo, pageRule, manifest, brandAssets = [], outputSha256, template = null } = {}) {
  const checks = [];
  checks.push(check('CANVAS_DIMENSIONS', sameRect(manifest?.canvas, pageRule?.canvas), { expected: pageRule?.canvas, actual: manifest?.canvas }));
  checks.push(check('OUTPUT_SHA256', Boolean(outputSha256) && outputSha256 === manifest?.outputSha256));

  const creativeTargetMatches = sameRect(manifest?.creative?.target, pageRule?.creative_area)
    && Number(manifest?.creative?.width) === Number(pageRule?.creative_area?.width)
    && Number(manifest?.creative?.height) === Number(pageRule?.creative_area?.height);
  const overlapsLockedArea = intersects(manifest?.creative?.target, pageRule?.brand_area)
    || intersects(manifest?.creative?.target, pageRule?.brand_footer_area);
  checks.push(check('CREATIVE_SAFE_AREA', creativeTargetMatches && !overlapsLockedArea, {
    expected: pageRule?.creative_area,
    actual: manifest?.creative?.target,
  }));

  const manifestAssets = Array.isArray(manifest?.brandAssets) ? manifest.brandAssets : [];
  const expectedTypes = pageRule?.apply_brand === true ? Object.keys(pageRule?.placements || {}) : [];
  const forbiddenTypes = Array.isArray(pageRule?.forbidden_asset_types) ? pageRule.forbidden_asset_types : [];
  const actualTypes = manifestAssets.map((asset) => asset.assetType);
  const pagePolicyPassed = pageRule?.apply_brand === true
    ? expectedTypes.length === actualTypes.length && expectedTypes.every((type) => actualTypes.includes(type))
    : manifestAssets.length === 0 && forbiddenTypes.every((type) => !actualTypes.includes(type));
  checks.push(check('PAGE_BRAND_POLICY', pagePolicyPassed, { pageNo: Number(pageNo), expectedTypes, actualTypes, forbiddenTypes }));

  for (const assetType of expectedTypes) {
    const manifestAsset = manifestAssets.find((asset) => asset.assetType === assetType);
    const officialAsset = brandAssets.find((asset) => asset.id === manifestAsset?.assetId && asset.asset_type === assetType);
    const officialSource = Boolean(officialAsset)
      && officialAsset.status === 'active'
      && (officialAsset.source_table || 'brand_assets') === 'brand_assets'
      && manifestAsset?.sourceTable === 'brand_assets';
    checks.push(check('OFFICIAL_ASSET_SOURCE', officialSource, { assetType }));
    checks.push(check('OFFICIAL_ASSET_SHA256', officialSource && manifestAsset.sha256 === officialAsset.content_sha256, { assetType }));

    let expectedTarget = null;
    try {
      expectedTarget = officialAsset ? computePlacement(officialAsset, pageRule.placements[assetType]) : null;
    } catch {
      expectedTarget = null;
    }
    checks.push(check('LOCKED_POSITION', Boolean(expectedTarget) && sameRect(manifestAsset?.target, expectedTarget), { assetType, expected: expectedTarget, actual: manifestAsset?.target }));
    const intrinsicRatio = Number(manifestAsset?.intrinsic?.width) / Number(manifestAsset?.intrinsic?.height);
    const targetRatio = Number(manifestAsset?.target?.width) / Number(manifestAsset?.target?.height);
    checks.push(check('PRESERVE_ASPECT_RATIO', manifestAsset?.preserveAspectRatio === true && Number.isFinite(intrinsicRatio) && Math.abs(intrinsicRatio - targetRatio) < 0.000001, { assetType }));
  }

  checks.push(check('TEMPLATE_LOCKS', !template || (manifest?.template?.assetId === template.id && manifest?.template?.sha256 === template.content_sha256 && manifest?.template?.locked === true)));
  const passed = checks.every((item) => item.passed);
  const logoCodes = new Set(['PAGE_BRAND_POLICY', 'OFFICIAL_ASSET_SOURCE', 'OFFICIAL_ASSET_SHA256']);
  const positionCodes = new Set(['CANVAS_DIMENSIONS', 'CREATIVE_SAFE_AREA', 'LOCKED_POSITION', 'PRESERVE_ASPECT_RATIO', 'TEMPLATE_LOCKS']);
  return {
    passed,
    summary: {
      logo: checks.filter((item) => logoCodes.has(item.code)).every((item) => item.passed) ? 'PASS' : 'FAIL',
      position: checks.filter((item) => positionCodes.has(item.code)).every((item) => item.passed) ? 'PASS' : 'FAIL',
      color: checks.filter((item) => item.code === 'OFFICIAL_ASSET_SHA256').every((item) => item.passed) ? 'PASS' : 'FAIL',
    },
    checks,
  };
}
