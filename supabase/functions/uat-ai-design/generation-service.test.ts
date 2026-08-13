import assert from "node:assert/strict";
import test from "node:test";
import { assertCanGenerateDemo, assertCanGenerateFinal, executeIdempotent } from "./generation-service.ts";

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
