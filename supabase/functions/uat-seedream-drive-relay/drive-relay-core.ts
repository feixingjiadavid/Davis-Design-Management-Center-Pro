const ALLOWED_EMAILS = new Set([
  'uat.requester@webank.com',
  'davis.design.ai@webank.com',
  'uat.leader@webank.com',
  'uat.admin@webank.com',
]);

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
