const BUILD = '20260820-drive-relay-proxy-v2';
const UPSTREAM = 'https://supffjeeouibhqdfqosk.supabase.co/functions/v1/uat-seedream-drive-relay';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-davis-relay-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Expose-Headers': 'content-type,content-length,x-drive-file-name,x-davis-relay-build',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify({ build: BUILD, ...(body as Record<string, unknown>) }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const body = await req.text();
    const headers: Record<string, string> = {
      'content-type': req.headers.get('content-type') || 'application/json',
    };
    const authorization = req.headers.get('authorization');
    const signature = req.headers.get('x-davis-relay-signature');
    if (authorization) headers.authorization = authorization;
    if (signature) headers['x-davis-relay-signature'] = signature;

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(120000),
    });

    const responseHeaders = new Headers(CORS);
    for (const name of ['content-type', 'content-length', 'cache-control', 'x-drive-file-name']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('x-davis-relay-build', BUILD);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: `DRIVE_RELAY_UPSTREAM_FAILED:${message}` }, 502);
  }
});
