const MIN_PROVIDER_PIXELS = 3_686_400;
const MAX_PROVIDER_SIDE = 4096;
const ALIGNMENT = 32;

const align = (value) => Math.ceil(Number(value) / ALIGNMENT) * ALIGNMENT;

export function resolveSeedreamProviderSize(width, height) {
  const targetWidth = Number(width);
  const targetHeight = Number(height);
  if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('SEEDREAM_SIZE_INVALID');
  }
  const scale = Math.max(1, Math.sqrt(MIN_PROVIDER_PIXELS / (targetWidth * targetHeight)));
  const providerWidth = align(targetWidth * scale);
  const providerHeight = align(targetHeight * scale);
  if (providerWidth > MAX_PROVIDER_SIDE || providerHeight > MAX_PROVIDER_SIDE) throw new Error('SEEDREAM_SIZE_UNSUPPORTED');
  return `${providerWidth}x${providerHeight}`;
}

