import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSupabaseSdk } from './supabase-sdk-loader.js';

test('falls back when the first ESM CDN stalls', async () => {
  const calls = [];
  const createClient = () => 'client';
  const result = await loadSupabaseSdk({
    moduleUrls: ['primary', 'secondary'],
    umdUrls: [],
    timeoutMs: 10,
    importModule: async (url) => {
      calls.push(url);
      if (url === 'primary') return await new Promise(() => {});
      return { createClient };
    },
  });
  assert.deepEqual(calls, ['primary', 'secondary']);
  assert.equal(result.createClient, createClient);
  assert.equal(result.source, 'secondary');
});

test('reports a deterministic error instead of hanging when every provider fails', async () => {
  await assert.rejects(
    () => loadSupabaseSdk({
      moduleUrls: ['primary'],
      umdUrls: [],
      timeoutMs: 5,
      importModule: async () => await new Promise(() => {}),
    }),
    /SUPABASE_SDK_LOAD_FAILED/,
  );
});
