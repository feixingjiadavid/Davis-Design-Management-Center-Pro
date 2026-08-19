import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDrivePreviewBlob, selectCurrentDemoPages } from './seedream-drive-preview-client.mjs';

test('selectCurrentDemoPages keeps latest current-version row for each page', () => {
  const rows = [
    { id:'old-v1', kind:'demo', model:'doubao-seedream-4-0-250828', prompt_version:'seedream-demo-design-director-v1', page_index:1, created_at:'2026-08-18T08:00:00Z', status:'ready', output:{drive_file_id:'old'} },
    { id:'p1-a', kind:'demo', model:'doubao-seedream-4-0-250828', prompt_version:'seedream-demo-creative-director-v2', page_index:1, created_at:'2026-08-18T09:00:00Z', status:'ready', output:{drive_file_id:'p1-old'} },
    { id:'p1-b', kind:'demo', model:'doubao-seedream-4-0-250828', prompt_version:'seedream-demo-creative-director-v2', page_index:1, created_at:'2026-08-18T10:00:00Z', status:'ready', output:{drive_file_id:'p1'} },
    { id:'p2', kind:'demo', model:'doubao-seedream-4-0-250828', prompt_version:'seedream-demo-creative-director-v2', page_index:2, created_at:'2026-08-18T10:01:00Z', status:'ready', output:{drive_file_id:'p2'} },
    { id:'p3', kind:'demo', model:'doubao-seedream-4-0-250828', prompt_version:'seedream-demo-creative-director-v2', page_index:3, created_at:'2026-08-18T10:02:00Z', status:'ready', output:{drive_file_id:'p3'} },
  ];
  const selected = selectCurrentDemoPages(rows);
  assert.deepEqual(selected.map(r => r.id), ['p1-b','p2','p3']);
});

test('fetchDrivePreviewBlob buffers complete image bytes and preserves content type', async () => {
  const fakeFetch = async () => new Response(new Uint8Array([1,2,3,4]), { status:200, headers:{'content-type':'image/jpeg'} });
  const blob = await fetchDrivePreviewBlob({ fetchImpl:fakeFetch, relayUrl:'https://relay.invalid', token:'jwt', fileId:'drive-file' });
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(blob.size, 4);
});

test('fetchDrivePreviewBlob rejects non-image relay responses', async () => {
  const fakeFetch = async () => new Response('{"error":"bad"}', { status:200, headers:{'content-type':'application/json'} });
  await assert.rejects(
    fetchDrivePreviewBlob({ fetchImpl:fakeFetch, relayUrl:'https://relay.invalid', token:'jwt', fileId:'drive-file' }),
    /DRIVE_PREVIEW_NOT_IMAGE/
  );
});
