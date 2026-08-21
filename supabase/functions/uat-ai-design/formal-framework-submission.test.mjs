import assert from 'node:assert/strict';
import { selectCompleteFrameworkGenerationGroup } from './formal-framework-submission.mjs';

const url = (page) => `https://x.supabase.co/storage/v1/object/public/designs/formal/p-${page}.png`;
const rows = [1,2,3].map((page) => ({ id:`g${page}`, generation_mode:'initial_framework', analysis_id:'a1', status:'ready', page_index:page, page_count:3, updated_at:'2026-08-20T00:00:00Z', output:{ formal_asset_url:url(page) } }));
const assets = [1,2,3].map(sort_order => ({ sort_order, asset_url:url(sort_order) }));
assert.deepEqual(selectCompleteFrameworkGenerationGroup(rows, assets).map(row => row.id), ['g1','g2','g3']);
assert.deepEqual(selectCompleteFrameworkGenerationGroup(rows.slice(0,2), assets), []);
assert.deepEqual(selectCompleteFrameworkGenerationGroup(rows.map((row,index) => index===1 ? {...row,status:'failed'} : row), assets), []);
assert.deepEqual(selectCompleteFrameworkGenerationGroup(rows, assets.map((asset,index) => index===1 ? {...asset,asset_url:url(99)} : asset)), []);
console.log('formal framework submission tests passed');
