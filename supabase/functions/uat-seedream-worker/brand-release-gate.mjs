// Single release gate for formal delivery.
// Only VI-passed branded_output can enter design_versions.

const PUBLIC_DESIGNS = '/storage/v1/object/public/designs/';

export function validateFormalRelease({ compositionRun, asset }) {
  const failures = [];

  if (!compositionRun || compositionRun.status !== 'passed') {
    failures.push('COMPOSITION_NOT_PASSED');
  }

  if (!compositionRun?.vi_check?.passed) {
    failures.push('VI_CHECK_REQUIRED');
  }

  if (!asset || asset.asset_role !== 'branded_output') {
    failures.push('BRANDED_OUTPUT_REQUIRED');
  }

  if (asset?.storage_bucket !== 'designs') {
    failures.push('DESIGNS_BUCKET_REQUIRED');
  }

  if (!String(asset?.asset_url || '').includes(PUBLIC_DESIGNS)) {
    failures.push('PUBLIC_DESIGNS_URL_REQUIRED');
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
