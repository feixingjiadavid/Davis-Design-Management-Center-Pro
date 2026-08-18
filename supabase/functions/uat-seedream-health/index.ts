const UAT_URL = 'https://bjzfkwxrvytgphvgwltl.supabase.co';
const UAT_PUBLISHABLE_KEY = 'sb_publishable__c7_KcaKy6NlBO0BKsmy2g_oGZmZSYV';
const ARK_IMAGE_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const ALLOWED_EMAILS = new Set(['uat.requester@webank.com','davis.design.ai@webank.com','uat.leader@webank.com','uat.admin@webank.com']);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: CORS }); }
async function validateUatJwt(jwt: string) {
  if (!jwt) throw new Error('UAT_JWT_REQUIRED');
  const response = await fetch(`${UAT_URL}/auth/v1/user`, {
    headers: { apikey: UAT_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('UAT_JWT_INVALID');
  const user = await response.json();
  const email = String(user?.email || '').toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) throw new Error('UAT_CALLER_FORBIDDEN');
  return email;
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const email = await validateUatJwt(jwt);
    const arkKey = String(Deno.env.get('ARK_API_KEY') || '').trim();
    if (!arkKey) return json({ ok: false, network_reachable: false, error: 'ARK_API_KEY_MISSING' }, 500);
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('ark-health-timeout'), 8_000);
    try {
      const response = await fetch(ARK_IMAGE_URL, {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${arkKey}` },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - started;
      console.log(JSON.stringify({ event: 'uat_seedream_health', email, status: response.status, latency_ms: latencyMs }));
      return json({ ok: true, network_reachable: true, status: response.status, latency_ms: latencyMs, endpoint: 'ark.cn-beijing.volces.com' });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = /timeout|timed out|abort/i.test(message);
    console.error(JSON.stringify({ event: 'uat_seedream_health_failed', error: message }));
    return json({ ok: false, network_reachable: false, error: timeout ? 'ARK_CONNECT_TIMEOUT' : message }, 503);
  }
});
