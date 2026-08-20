const BUILD = '20260820-supabase-sdk-proxy-v2';
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.110.9/dist/umd/supabase.js',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function fail(message: string, status = 502) {
  return new Response(`throw new Error(${JSON.stringify(`SUPABASE_SDK_PROXY_FAILED:${message}`)});`, {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Davis-SDK-Proxy-Build': BUILD,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!['GET', 'HEAD'].includes(req.method)) return fail('METHOD_NOT_ALLOWED', 405);

  const format = new URL(req.url).searchParams.get('format') === 'umd' ? 'umd' : 'esm';
  const failures: string[] = [];
  for (const source of SOURCES) {
    try {
      const response = await fetch(source, {
        headers: { 'user-agent': 'Davis-UAT-SDK-Proxy/2.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        failures.push(`${source}:${response.status}`);
        continue;
      }
      const text = await response.text();
      if (!text.includes('createClient') || !text.includes('var supabase')) {
        failures.push(`${source}:CREATE_CLIENT_MISSING`);
        continue;
      }
      const body = format === 'umd'
        ? text
        : `${text}\nexport const createClient = supabase.createClient;\nexport default supabase;\n`;
      return new Response(req.method === 'HEAD' ? null : body, {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
          'X-Davis-SDK-Proxy-Build': BUILD,
          'X-Davis-SDK-Format': format,
          'X-Davis-SDK-Upstream': source,
        },
      });
    } catch (error) {
      failures.push(`${source}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return fail(failures.join(' | '));
});
