import assert from 'node:assert/strict';
import { isLeaderUser, selectHdPages, computeOverviewCardSize, defaultReviewMode } from './leader-demo-hd-review-core.mjs';

assert.equal(isLeaderUser({ account_type: 'uat_leader', enName: 'uat.leader' }), true);
assert.equal(isLeaderUser({ enName: 'judyzzhang' }), true);
assert.equal(isLeaderUser({ account_type: 'uat_requester', enName: 'uat.requester' }), false);

const rows = [
  { id:'old2', page_index:2, status:'failed', created_at:'2026-08-18T01:00:00Z', output:{} },
  { id:'p1', page_index:1, status:'ready', created_at:'2026-08-18T02:00:00Z', output:{drive_file_id:'f1'} },
  { id:'p2', page_index:2, status:'ready', created_at:'2026-08-18T03:00:00Z', output:{drive_file_id:'f2'} },
  { id:'p3', page_index:3, status:'ready', created_at:'2026-08-18T04:00:00Z', output:{drive_file_id:'f3'} },
];
assert.deepEqual(selectHdPages(rows).map(x => [x.page, x.fileId]), [[1,'f1'],[2,'f2'],[3,'f3']]);
assert.equal(defaultReviewMode(), 'overview');

const fit = computeOverviewCardSize({ viewportWidth: 1600, viewportHeight: 900, pageCount: 3, aspectRatio: 1242/1660 });
assert.equal(fit.columns, 3);
assert.ok(fit.cardHeight <= fit.availableHeight, `card height ${fit.cardHeight} should fit ${fit.availableHeight}`);
assert.ok(fit.totalWidth <= fit.availableWidth + 0.01, `total width ${fit.totalWidth} should fit ${fit.availableWidth}`);

const compact = computeOverviewCardSize({ viewportWidth: 1366, viewportHeight: 768, pageCount: 3, aspectRatio: 1242/1660 });
assert.ok(compact.cardHeight <= compact.availableHeight);
console.log('leader demo hd review core: 8/8 passed');
