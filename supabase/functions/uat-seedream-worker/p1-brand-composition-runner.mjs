import { buildP1BrandCompositionInput } from './p1-brand-composition-demo.mjs';

/**
 * P1实际应用入口
 * AI原稿 -> Brand Resolver -> Composer
 */
export function runP1Composition({ rawCreative, background = 'light' }) {
  const compositionInput = buildP1BrandCompositionInput({
    rawCreative,
    background
  });

  if (!compositionInput.readyForComposer) {
    throw new Error('P1_COMPOSITION_NOT_READY');
  }

  return {
    stage: 'composer_input_ready',
    scene: compositionInput.scene,
    rawCreative: compositionInput.rawCreative,
    brandAssets: compositionInput.brandAssets,
    next: 'brand-composer'
  };
}
