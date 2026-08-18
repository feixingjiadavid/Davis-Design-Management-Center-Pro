import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldContinuePolling, healthResult } from './seedream-demo-guard-core.js';

test('continues polling while request was just sent before backend status appears', () => {
  assert.equal(shouldContinuePolling({ inflight: true, text: '请求已发出，等待 Seedream…' }), true);
});

test('continues polling while a real generation row is active', () => {
  assert.equal(shouldContinuePolling({ inflight: true, text: 'Seedream 4.0 · 第 1 / 3 页生成中' }), true);
});

test('stops polling on terminal failure', () => {
  assert.equal(shouldContinuePolling({ inflight: true, text: 'Seedream 4.0 Demo 生成失败' }), false);
});

test('stops polling on completed demo', () => {
  assert.equal(shouldContinuePolling({ inflight: true, text: 'Seedream 4.0 Demo 已完成 3 / 3' }), false);
});

test('health result requires network reachability', () => {
  assert.deepEqual(healthResult({ ok: true, network_reachable: true, status: 405 }), { ok: true, status: 405 });
  assert.deepEqual(healthResult({ ok: false, network_reachable: false, error: 'ARK_CONNECT_TIMEOUT' }), { ok: false, error: 'ARK_CONNECT_TIMEOUT' });
});
