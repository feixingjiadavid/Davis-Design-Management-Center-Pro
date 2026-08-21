function finitePositive(value, code) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(code);
  return number;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function computePlacement(asset, placement) {
  const intrinsicWidth = finitePositive(asset?.intrinsic_width, 'BRAND_ASSET_INTRINSIC_WIDTH_INVALID');
  const intrinsicHeight = finitePositive(asset?.intrinsic_height, 'BRAND_ASSET_INTRINSIC_HEIGHT_INVALID');
  const maxWidth = finitePositive(placement?.max_width, 'BRAND_PLACEMENT_WIDTH_INVALID');
  const maxHeight = finitePositive(placement?.max_height, 'BRAND_PLACEMENT_HEIGHT_INVALID');
  if (placement?.preserve_aspect_ratio !== true) throw new Error('BRAND_ASPECT_RATIO_MUST_BE_PRESERVED');
  const scale = Math.min(maxWidth / intrinsicWidth, maxHeight / intrinsicHeight);
  const width = Number((intrinsicWidth * scale).toFixed(6));
  const height = Number((intrinsicHeight * scale).toFixed(6));
  const baseX = Number(placement.x || 0);
  const baseY = Number(placement.y || 0);
  return {
    x: Number((placement.align === 'center' ? baseX + (maxWidth - width) / 2 : baseX).toFixed(6)),
    y: baseY,
    width,
    height,
  };
}

function exactOfficialAsset(asset, assetType) {
  return asset
    && asset.asset_type === assetType
    && asset.status === 'active'
    && (asset.source_table || 'brand_assets') === 'brand_assets'
    && asset.mime_type === 'image/svg+xml'
    && String(asset.svg_text || '').trim();
}

function assertSafeOfficialSvg(svgText, assetType) {
  const unsafeElementOrHandler = /<\s*(script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=/i.test(svgText);
  const hrefs = [...svgText.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1].trim());
  const unsafeHref = hrefs.some((href) => !(href.startsWith('#') || href.startsWith('data:image/')));
  if (unsafeElementOrHandler || unsafeHref) throw new Error(`BRAND_ASSET_SVG_UNSAFE:${assetType}`);
}

export async function composeBrandedSvg({ pageNo, pageRule, rawCreative, brandAssets = [], templateLayer = null } = {}) {
  if (!pageRule?.canvas || !pageRule?.creative_area) throw new Error('BRAND_PAGE_RULE_INVALID');
  if (!rawCreative?.data_url || !rawCreative?.id) throw new Error('RAW_CREATIVE_REQUIRED');
  const canvas = pageRule.canvas;
  const creativeArea = pageRule.creative_area;
  const sourceWidth = finitePositive(rawCreative.width, 'RAW_CREATIVE_WIDTH_INVALID');
  const sourceHeight = finitePositive(rawCreative.height, 'RAW_CREATIVE_HEIGHT_INVALID');
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = Number(creativeArea.width) / Number(creativeArea.height);
  if (Math.abs(sourceRatio - targetRatio) > 0.015) throw new Error('RAW_CREATIVE_ASPECT_RATIO_MISMATCH');

  const manifestAssets = [];
  const brandImages = [];
  const placements = pageRule.apply_brand === true && pageRule.placements && typeof pageRule.placements === 'object'
    ? pageRule.placements
    : {};

  for (const assetType of Object.keys(placements)) {
    const asset = brandAssets.find((candidate) => candidate.asset_type === assetType && candidate.status === 'active');
    if (!exactOfficialAsset(asset, assetType)) throw new Error(`BRAND_ASSET_REQUIRED:${assetType}`);
    assertSafeOfficialSvg(asset.svg_text, assetType);
    const actualHash = await sha256Hex(asset.svg_text);
    if (actualHash !== asset.content_sha256) throw new Error(`BRAND_ASSET_HASH_MISMATCH:${assetType}`);
    const target = computePlacement(asset, placements[assetType]);
    const encodedSvg = bytesToBase64(new TextEncoder().encode(asset.svg_text));
    brandImages.push(`<image data-brand-asset="${escapeAttribute(assetType)}" x="${target.x}" y="${target.y}" width="${target.width}" height="${target.height}" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${encodedSvg}"/>`);
    manifestAssets.push({
      assetId: asset.id,
      assetType,
      sourceTable: 'brand_assets',
      sha256: asset.content_sha256,
      intrinsic: { width: Number(asset.intrinsic_width), height: Number(asset.intrinsic_height) },
      target,
      preserveAspectRatio: true,
    });
  }

  const templateImage = templateLayer?.data_url
    ? `<image data-template="locked" x="0" y="0" width="${canvas.width}" height="${canvas.height}" preserveAspectRatio="none" href="${escapeAttribute(templateLayer.data_url)}"/>`
    : '';
  const background = escapeAttribute(pageRule.brand_background || '#FFFFFF');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
    `<rect width="${canvas.width}" height="${canvas.height}" fill="${background}"/>`,
    templateImage,
    `<image data-stage="raw_creative" x="${creativeArea.x}" y="${creativeArea.y}" width="${creativeArea.width}" height="${creativeArea.height}" preserveAspectRatio="xMidYMid slice" href="${escapeAttribute(rawCreative.data_url)}"/>`,
    ...brandImages,
    '</svg>',
  ].filter(Boolean).join('');
  const contentSha256 = await sha256Hex(svg);
  const manifest = {
    version: 1,
    pageNo: Number(pageNo),
    canvas: { ...canvas },
    creative: {
      assetId: rawCreative.id,
      sha256: rawCreative.content_sha256,
      width: Number(creativeArea.width),
      height: Number(creativeArea.height),
      source: { width: sourceWidth, height: sourceHeight },
      target: { ...creativeArea },
    },
    template: templateLayer ? { assetId: templateLayer.id, sha256: templateLayer.content_sha256, locked: true } : null,
    brandAssets: manifestAssets,
    outputSha256: contentSha256,
  };
  return { svg, contentSha256, manifest };
}

