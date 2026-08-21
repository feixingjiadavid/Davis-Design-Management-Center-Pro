// Deterministic official brand asset resolver.
// Logo source is always Google Drive -> brand_assets index.

export function resolveBrandAssets({ rule, assets = [] }) {
  const required = rule?.required_assets || [];
  const resolved = required.map((id) => assets.find((item) => item.id === id));

  if (resolved.some((item) => !item || item.status !== 'active' || item.storage_provider !== 'google_drive')) {
    return { publishable: false, assets: [], reason: 'missing_active_google_drive_asset' };
  }

  return {
    publishable: true,
    assets: resolved.map((asset) => ({
      id: asset.id,
      drive_file_id: asset.drive_file_id,
      drive_path: asset.drive_path,
      sha256: asset.sha256,
      svg_url: asset.url
    }))
  };
}
