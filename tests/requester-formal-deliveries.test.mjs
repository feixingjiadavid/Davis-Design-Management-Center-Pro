import assert from 'node:assert/strict';
import { groupFormalVersions, isFormalDeliveryAssetUrl, renderFormalVersionsHtml } from '../js/requester-formal-deliveries.js';

const storage = 'https://example.supabase.co/storage/v1/object/public/designs/formal/task/v1/p-1.png';
assert.equal(isFormalDeliveryAssetUrl(storage), true);
assert.equal(isFormalDeliveryAssetUrl('https://drive.google.com/file/d/internal'), false);
assert.equal(isFormalDeliveryAssetUrl('https://provider.example/temp.png'), false);

const grouped = groupFormalVersions([
  { id:'v2', version_no:2, version_name:'第一次修改', status:'pending_review', created_at:'2026-08-20T00:00:00Z', creator:'AI' },
  { id:'v1', version_no:1, version_name:'框架方案', status:'accepted', created_at:'2026-08-19T00:00:00Z', creator:'AI' },
], [
  { id:'bad', design_version_id:'v2', asset_url:'https://drive.google.com/file/d/x', sort_order:0 },
  { id:'a2', design_version_id:'v2', asset_url:storage.replace('p-1','p-2'), sort_order:1 },
  { id:'a1', design_version_id:'v2', asset_url:storage, sort_order:0 },
]);
assert.deepEqual(grouped.map(item => item.id), ['v1','v2']);
assert.deepEqual(grouped[1].assets.map(item => item.id), ['a1','a2']);
const html = renderFormalVersionsHtml(grouped);
assert.match(html, /v1 框架方案/);
assert.match(html, /v2 第一次修改/);
assert.match(html, /当前最新版本/);
assert.match(html, /点击图片查看大图/);
assert.doesNotMatch(html, /Google Drive|Seedream|run id|failed|retry|Prompt/);

console.log('requester formal delivery tests passed');
