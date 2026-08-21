import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSeedreamProviderSize } from './provider-size.mjs';

test('P1 provider canvas preserves the Creative Area ratio and provider pixel floor', () => {
  const size = resolveSeedreamProviderSize(1242, 1260);
  const [width, height] = size.split('x').map(Number);
  assert.equal(width % 32, 0);
  assert.equal(height % 32, 0);
  assert.ok(width * height >= 3_686_400);
  assert.ok(Math.abs((width / height) - (1242 / 1260)) < 0.015);
});

test('full-canvas pages also preserve their requested aspect ratio', () => {
  const size = resolveSeedreamProviderSize(1242, 1660);
  const [width, height] = size.split('x').map(Number);
  assert.ok(width * height >= 3_686_400);
  assert.ok(Math.abs((width / height) - (1242 / 1660)) < 0.015);
});

