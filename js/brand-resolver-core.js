export function resolveBrandAssets(context = {}, registry = {}) {
  const scene = context.scene || 'culture_event';
  const rule = registry.rules?.[scene] || registry.rules?.culture_event || {};
  const brands = [...(rule.required || []), ...(rule.optional || [])];
  const variant = context.background === 'dark' ? 'white' : 'color';

  return brands.map((brand) => {
    const asset = registry.assets?.[brand];
    if (!asset) throw new Error(`BRAND_ASSET_NOT_FOUND:${brand}`);
    return {
      brand,
      level: asset.level,
      source: asset.source,
      editable: asset.editable,
      variant,
      logo: asset.variants?.[variant]
    };
  });
}

export function validateBrandAssets(assets = []) {
  const failures = assets.filter((item) => item.source !== 'google_drive' || item.editable !== false);
  return { passed: failures.length === 0, failures };
}
