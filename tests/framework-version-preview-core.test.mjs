import assert from 'node:assert/strict';
import { selectFrameworkPreviewInput, versionPreviewPath, patchFrameworkHistory } from '../js/framework-version-preview-core.mjs';

const history=[
  {action:'create'},
  {action:'submit_framework',version:'v-1',img_url:'',drive_file_ids:['p1','p2','p3']},
];

const picked=selectFrameworkPreviewInput(history);
assert.equal(picked.index,1);
assert.deepEqual(picked.driveFileIds,['p1','p2','p3']);
assert.equal(picked.needsPreview,true);
assert.equal(versionPreviewPath('TK-0001','v-1'),'TK-0001/framework-v-1.jpg');

const patched=patchFrameworkHistory(history,1,'TK-0001/framework-v-1.jpg');
assert.equal(patched[1].preview_storage_path,'TK-0001/framework-v-1.jpg');
assert.equal(patched[1].preview_bucket,'version-previews');
assert.equal(patched[1].img_url,'');
console.log('framework-version-preview-core tests passed');
