import { createClient } from 'npm:@supabase/supabase-js@2';
import { archiveRelaySignature, constantTimeEqual, isAllowedUatEmail, outputFileName, safeTaskId } from './drive-relay-core.ts';

const UAT_URL = 'https://bjzfkwxrvytgphvgwltl.supabase.co';
const UAT_PUBLISHABLE_KEY = 'sb_publishable__c7_KcaKy6NlBO0BKsmy2g_oGZmZSYV';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const SEEDREAM_DRIVE_ROOT_FOLDER_ID = '1vg12NJfXRXp8KBkvX8uh2RGTYmN0BPWu';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-davis-relay-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function out(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: CORS }); }
function env(name: string) { return String(Deno.env.get(name) || '').trim(); }
async function readJsonSafe(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
}
async function validateUatJwt(jwt: string) {
  if (!jwt) throw new Error('UAT_JWT_REQUIRED');
  const response = await fetch(`${UAT_URL}/auth/v1/user`, {
    headers: { apikey: UAT_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('UAT_JWT_INVALID');
  const user = await response.json();
  if (!isAllowedUatEmail(user?.email)) throw new Error('UAT_CALLER_FORBIDDEN');
  return { id: String(user?.id || ''), email: String(user?.email || '') };
}
async function authenticateCaller(request: Request) {
  const arkKey = env('ARK_API_KEY');
  const suppliedSignature = String(request.headers.get('x-davis-relay-signature') || '').trim();
  if (arkKey && suppliedSignature) {
    const expected = await archiveRelaySignature(arkKey);
    if (constantTimeEqual(expected, suppliedSignature)) return { id: 'server', email: 'uat-ark-gateway@internal' };
  }
  const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return await validateUatJwt(jwt);
}
async function resolveRefreshToken(admin: any) {
  const { data, error } = await admin.rpc('get_seedance_google_refresh_token');
  if (!error && String(data || '').trim()) return String(data).trim();
  const fallback = env('GOOGLE_REFRESH_TOKEN');
  if (fallback) return fallback;
  throw new Error(`GOOGLE_REFRESH_TOKEN_MISSING${error ? `:${error.message}` : ''}`);
}
async function googleAccessToken(admin: any) {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  const refreshToken = await resolveRefreshToken(admin);
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GOOGLE_OAUTH_SECRETS_MISSING');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await readJsonSafe(response);
  if (!response.ok || !payload?.access_token) throw new Error(`GOOGLE_ACCESS_TOKEN_FAILED:${response.status}`);
  return String(payload.access_token);
}
function escapeDriveQuery(value: string) { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
async function ensureTaskFolder(accessToken: string, taskId: string) {
  const name = safeTaskId(taskId);
  const q = `'${SEEDREAM_DRIVE_ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escapeDriveQuery(name)}' and trashed=false`;
  const search = await fetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,webViewLink)&pageSize=10`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000),
  });
  const found = await readJsonSafe(search);
  if (!search.ok) throw new Error(`GOOGLE_DRIVE_FOLDER_SEARCH_FAILED:${search.status}`);
  const existing = Array.isArray(found?.files) ? found.files[0] : null;
  if (existing?.id) return existing;
  const created = await fetch(`${DRIVE_API}?fields=id,name,webViewLink,parents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [SEEDREAM_DRIVE_ROOT_FOLDER_ID], appProperties: { davis_design_task_id: name } }),
    signal: AbortSignal.timeout(20_000),
  });
  const folder = await readJsonSafe(created);
  if (!created.ok || !folder?.id) throw new Error(`GOOGLE_DRIVE_FOLDER_CREATE_FAILED:${created.status}`);
  return folder;
}
async function findExistingFile(accessToken: string, folderId: string, fileName: string) {
  const q = `'${folderId}' in parents and name='${escapeDriveQuery(fileName)}' and trashed=false`;
  const response = await fetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,mimeType,webViewLink,thumbnailLink,parents)&pageSize=10`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000),
  });
  const payload = await readJsonSafe(response);
  if (!response.ok) throw new Error(`GOOGLE_DRIVE_FILE_SEARCH_FAILED:${response.status}`);
  return Array.isArray(payload?.files) ? payload.files[0] || null : null;
}
async function uploadImage(accessToken: string, sourceUrl: string, folderId: string, fileName: string, taskId: string, pageIndex: number) {
  const existing = await findExistingFile(accessToken, folderId, fileName);
  if (existing?.id) return { ...existing, idempotent_replay: true };
  const source = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!source.ok || !source.body) throw new Error(`SEEDREAM_IMAGE_DOWNLOAD_FAILED:${source.status}`);
  const contentType = source.headers.get('content-type') || 'image/jpeg';
  const metadata = {
    name: fileName,
    mimeType: contentType,
    parents: [folderId],
    appProperties: { davis_design_task_id: safeTaskId(taskId), page_index: String(pageIndex), provider: 'seedream-4.0' },
  };
  const init = await fetch(`${DRIVE_UPLOAD_API}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,parents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': contentType },
    body: JSON.stringify(metadata),
    signal: AbortSignal.timeout(20_000),
  });
  if (!init.ok) throw new Error(`GOOGLE_DRIVE_UPLOAD_INIT_FAILED:${init.status}`);
  const uploadUrl = init.headers.get('location');
  if (!uploadUrl) throw new Error('GOOGLE_DRIVE_RESUMABLE_LOCATION_MISSING');
  const headers: Record<string, string> = { 'Content-Type': contentType };
  const contentLength = source.headers.get('content-length');
  if (contentLength) headers['Content-Length'] = contentLength;
  const uploaded = await fetch(uploadUrl, { method: 'PUT', headers, body: source.body, signal: AbortSignal.timeout(120_000) });
  const file = await readJsonSafe(uploaded);
  if (!uploaded.ok || !file?.id) throw new Error(`GOOGLE_DRIVE_UPLOAD_FAILED:${uploaded.status}`);
  return file;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return out({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const caller = await authenticateCaller(request);
    const supabaseUrl = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('RELAY_SUPABASE_ENV_MISSING');
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'health') {
      let refreshToken = false;
      try { refreshToken = Boolean(await resolveRefreshToken(admin)); } catch {}
      return out({ ok: Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && refreshToken), google_client_id_present: Boolean(env('GOOGLE_CLIENT_ID')), google_client_secret_present: Boolean(env('GOOGLE_CLIENT_SECRET')), google_refresh_token_present: refreshToken });
    }
    const taskId = safeTaskId(body?.task_id);
    const pageIndex = Math.max(1, Number(body?.page_index) || 1);
    const sourceUrl = String(body?.source_url || '').trim();
    if (!/^https?:\/\//i.test(sourceUrl)) throw new Error('DRIVE_SOURCE_URL_REQUIRED');
    const accessToken = await googleAccessToken(admin);
    const folder = await ensureTaskFolder(accessToken, taskId);
    const fileName = outputFileName(taskId, pageIndex);
    const file = await uploadImage(accessToken, sourceUrl, String(folder.id), fileName, taskId, pageIndex);
    const driveUrl = String(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`);
    const thumbnailUrl = String(file.thumbnailLink || `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`);
    console.log(JSON.stringify({ event: 'uat_seedream_drive_archived', caller: caller.email, task_id: taskId, page_index: pageIndex, drive_file_id: file.id, idempotent_replay: Boolean(file.idempotent_replay) }));
    return out({ ok: true, drive_file_id: file.id, drive_url: driveUrl, drive_thumbnail_url: thumbnailUrl, drive_folder_id: folder.id, drive_folder_url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`, drive_file_name: file.name || fileName, idempotent_replay: Boolean(file.idempotent_replay) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /JWT|FORBIDDEN|SIGNATURE/.test(message) ? 401 : /GOOGLE_/.test(message) ? 502 : 400;
    return out({ ok: false, error: message }, status);
  }
});
