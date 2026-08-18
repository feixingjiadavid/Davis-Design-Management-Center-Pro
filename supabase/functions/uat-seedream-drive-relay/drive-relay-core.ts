const ALLOWED_EMAILS = new Set([
  'uat.requester@webank.com',
  'davis.design.ai@webank.com',
  'uat.leader@webank.com',
  'uat.admin@webank.com',
]);
const encoder = new TextEncoder();

export function safeTaskId(value: unknown) {
  return String(value || 'task')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'task';
}

export function outputFileName(taskId: string, pageIndex: number) {
  const page = String(Math.max(1, Number(pageIndex) || 1)).padStart(2, '0');
  return `${safeTaskId(taskId)}_Page${page}_Seedream4_Demo.jpg`;
}

export function isAllowedUatEmail(email: unknown) {
  return ALLOWED_EMAILS.has(String(email || '').trim().toLowerCase());
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function archiveRelaySignature(secret: string) {
  if (!String(secret || '').trim()) throw new Error('RELAY_SECRET_REQUIRED');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode('davis-seedream-drive-relay:v1'));
  return hex(new Uint8Array(signed));
}

export function constantTimeEqual(left: unknown, right: unknown) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
