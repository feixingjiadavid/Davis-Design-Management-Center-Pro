import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExistingPage } from './page-policy.ts';

test('ready and confirmed pages are reused without another provider call',()=>{
  assert.equal(classifyExistingPage({status:'ready'}).action,'reuse');
  assert.equal(classifyExistingPage({status:'confirmed'}).action,'reuse');
});

test('a live generating page is never submitted again',()=>{
  const now=Date.parse('2026-08-18T08:30:00Z');
  assert.equal(classifyExistingPage({status:'generating',created_at:'2026-08-18T08:29:00Z'},now).action,'wait');
});

test('a stale generating page is reported as stale instead of auto-retried',()=>{
  const now=Date.parse('2026-08-18T08:40:00Z');
  assert.equal(classifyExistingPage({status:'generating',created_at:'2026-08-18T08:29:00Z'},now).action,'stale');
});

test('failed page requires a new explicit manual run',()=>{
  assert.equal(classifyExistingPage({status:'failed'}).action,'failed');
});
