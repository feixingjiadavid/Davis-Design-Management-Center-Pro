import { validateFormalRelease } from './brand-release-gate.mjs';

export function prepareFormalPublisherInput({ compositionRun, brandedAsset } = {}) {
  const gate = validateFormalRelease({ compositionRun, asset: brandedAsset });

  if (!gate.passed) {
    return {
      publishable: false,
      failures: gate.failures,
      asset: null,
    };
  }

  return {
    publishable: true,
    failures: [],
    asset: brandedAsset,
  };
}
