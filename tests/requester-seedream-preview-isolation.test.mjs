import assert from 'node:assert/strict';

const realSetTimeout = globalThis.setTimeout;
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};

async function runPreviewBootstrap(pathname, moduleSuffix) {
  let generationQueries = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return Promise.resolve({ data: [], error: null }); },
  };
  const client = {
    from(table) {
      if (table === 'uat_design_generations') generationQueries += 1;
      return query;
    },
  };

  globalThis.location = { pathname, search: '?id=TK-0001' };
  globalThis.window = { addEventListener() {} };
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return { dataset: { id: 'TK-0001' } }; },
  };

  const module = await import(`../js/seedream-drive-preview-ui-v7.js?${moduleSuffix}`);
  module.bootstrapSeedreamDrivePreviewUIV7(client);
  await new Promise((resolve) => realSetTimeout(resolve, 20));
  return generationQueries;
}

assert.equal(
  await runPreviewBootstrap('/task-detail-requester.html', 'requester-isolation'),
  0,
  'requester must never query AI Demo generations',
);
assert.equal(
  await runPreviewBootstrap('/ai-designer-workspace.html', 'ai-console-preserved'),
  1,
  'AI Designer Console must retain its Demo preview query',
);

console.log('requester Seedream preview isolation tests passed');

