import assert from "node:assert/strict";
import test from "node:test";
import { fetchArkWithRetry, isRetryableArkNetworkError } from "./ark-retry.ts";

test("recognizes the Supabase tcp connect timeout as retryable", () => {
  assert.equal(
    isRetryableArkNetworkError(new Error("error sending request for url: tcp connect error: Connection timed out (os error 110)")),
    true,
  );
});

test("retries a TCP connect timeout once and then succeeds", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new Error("error sending request for url: tcp connect error: Connection timed out (os error 110)");
    return new Response("{}", { status: 200 });
  };
  const response = await fetchArkWithRetry("https://ark.example/images", { method: "POST" }, {
    fetcher: fetcher as typeof fetch,
    delaysMs: [0, 0],
    attemptTimeoutMs: 1000,
    sleepFn: async () => {},
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("does not retry non-network programming failures", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    throw new Error("bad json");
  };
  await assert.rejects(
    () => fetchArkWithRetry("https://ark.example/images", {}, {
      fetcher: fetcher as typeof fetch,
      delaysMs: [0, 0],
      attemptTimeoutMs: 1000,
      sleepFn: async () => {},
    }),
    /bad json/,
  );
  assert.equal(calls, 1);
});
