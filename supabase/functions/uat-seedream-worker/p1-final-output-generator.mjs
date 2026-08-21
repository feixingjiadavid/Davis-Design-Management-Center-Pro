import { buildP1BrandCompositionInput } from './p1-brand-composition-demo.mjs';

/**
 * P1 final output generation entry.
 * Flow:
 * raw_creative -> Brand Resolver -> Composer input -> branded_output
 */
export function generateP1FinalOutput({ rawCreative, background = 'light' } = {}) {
  if (!rawCreative?.id) {
    throw new Error('RAW_CREATIVE_REQUIRED');
  }

  const compositionInput = buildP1BrandCompositionInput({
    background,
    rawCreative,
  });

  return {
    outputStage: 'branded_output_ready',
    scene: compositionInput.scene,
    sourceCreative: compositionInput.rawCreative.id,
    brandLayers: compositionInput.brandAssets.map((asset) => ({
      brand: asset.brand,
      variant: asset.variant,
      source: asset.source,
      drive_file_id: asset.drive_file_id,
    })),
    vi: {
      officialAssetOnly: true,
      generatedLogoForbidden: true,
      aspectRatioLocked: true,
    },
    composerInput: compositionInput,
  };
}
