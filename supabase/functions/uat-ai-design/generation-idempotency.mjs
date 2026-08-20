export async function stableGenerationUuid(seed = '') {
  const bytes = new TextEncoder().encode(String(seed || ''));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const value = digest.slice(0, 16);
  value[6] = (value[6] & 0x0f) | 0x50;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}