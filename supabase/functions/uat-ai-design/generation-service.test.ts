import assert from "node:assert/strict";
import test from "node:test";
import { assertCanGenerateDemo, assertCanGenerateFinal, executeIdempotent, resolveDemoSize } from "./generation-service.ts";

test("blocks Demo generation until requirement understanding is confirmed", () => {
  assert.throws(() => assertCanGenerateDemo("understanding_ready"), /UNDERSTANDING_CONFIRMATION_REQUIRED/);
  assert.doesNotThrow(() => assertCanGenerateDemo("confirmed"));
});

test("blocks final generation until Demo is confirmed", () => {
  assert.throws(() => assertCanGenerateFinal("ready", "demo"), /DEMO_CONFIRMATION_REQUIRED/);
  assert.throws(() => assertCanGenerateFinal("confirmed", "final"), /CONFIRMED_DEMO_REQUIRED/);
  assert.doesNotThrow(() => assertCanGenerateFinal("confirmed", "demo"));
});

test("returns an existing idempotent generation without calling provider again", async () => {
  let providerCalls = 0;
  const existing = { id: "generation-1", status: "ready" };
  const result = await executeIdempotent(existing, async () => {
    providerCalls += 1;
    return { id: "generation-2" };
  });
  assert.equal(result, existing);
  assert.equal(providerCalls, 0);
});

test("maps 小蓝书 to 1242x1660", () => {
  assert.deepEqual(resolveDemoSize({ channels: ["小蓝书"], dimensions: [] }), { width: 1242, height: 1660 });
});

test("explicit dimensions override the channel preset", () => {
  assert.deepEqual(resolveDemoSize({ channels: ["小蓝书"], dimensions: ["1080x1440px"] }), { width: 1080, height: 1440 });
});

test("refuses to guess when neither an explicit size nor a known preset exists", () => {
  assert.throws(() => resolveDemoSize({ channels: ["邮件"], dimensions: [] }), /DEMO_SIZE_REQUIRED/);
});
