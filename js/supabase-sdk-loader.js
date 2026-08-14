const DEFAULT_MODULE_URLS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm',
  'https://esm.sh/@supabase/supabase-js@2.110.9?bundle',
];

const DEFAULT_UMD_URLS = [
  'https://unpkg.com/@supabase/supabase-js@2.110.9',
];

function timeoutError(label) {
  const error = new Error(`${label}_TIMEOUT`);
  error.code = `${label}_TIMEOUT`;
  return error;
}

export function withTimeout(promise, timeoutMs, label = 'RESOURCE') {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(label)), timeoutMs);
    }),
  ]);
}

export function defaultLoadScript(url, globalObject = globalThis) {
  return new Promise((resolve, reject) => {
    const document = globalObject.document;
    if (!document?.createElement) return reject(new Error('DOCUMENT_UNAVAILABLE'));
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`SCRIPT_LOAD_FAILED:${url}`));
    document.head.appendChild(script);
  });
}

export async function loadSupabaseSdk({
  moduleUrls = DEFAULT_MODULE_URLS,
  umdUrls = DEFAULT_UMD_URLS,
  timeoutMs = 5000,
  importModule = (url) => import(url),
  loadScript = defaultLoadScript,
  globalObject = globalThis,
} = {}) {
  const failures = [];

  for (const url of moduleUrls) {
    try {
      const mod = await withTimeout(importModule(url), timeoutMs, 'SUPABASE_ESM');
      if (typeof mod?.createClient !== 'function') throw new Error('CREATE_CLIENT_MISSING');
      return { createClient: mod.createClient, source: url, mode: 'esm' };
    } catch (error) {
      failures.push(`${url} => ${error?.message || String(error)}`);
    }
  }

  for (const url of umdUrls) {
    try {
      await withTimeout(loadScript(url, globalObject), timeoutMs, 'SUPABASE_UMD');
      const createClient = globalObject?.supabase?.createClient;
      if (typeof createClient !== 'function') throw new Error('CREATE_CLIENT_MISSING');
      return { createClient, source: url, mode: 'umd' };
    } catch (error) {
      failures.push(`${url} => ${error?.message || String(error)}`);
    }
  }

  throw new Error(`SUPABASE_SDK_LOAD_FAILED: ${failures.join(' | ')}`);
}
