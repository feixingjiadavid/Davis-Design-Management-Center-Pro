import assert from "node:assert/strict";
import test from "node:test";
import {
  generateSeedreamDemo,
  generateSeedreamFinal,
  resolveSeedreamProviderSize,
  SEEDREAM_DEMO_PROXY_URL,
} from "./seedream-client.ts";

test("aligns requested Demo dimensions to Seedream 32px provider grid", () => {
  assert.deepEqual(resolveSeedreamProviderSize({ width: 1242, height: 1660 }), { width: 1248, height: 1664 });
  assert.deepEqual(resolveSeedreamProviderSize({ width: 1248, height: 1664 }), { width: 1248, height: 1664 });
});

test("Seedream Demo client forwards UAT JWT and action to shared Ark gateway", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (url: any, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({
      ok: true,
      provider: "seedream",
      model: "doubao-seedream-4-0-250828",
      image_url: "https://example.com/demo.jpg",
      storage_path: "uat-seedream-outputs/TK-0001/page-02.jpg",
      provider_requested_size: "1728x2304",
      actual_size: "1728x2304",
      input_image_count: 2,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const output = await generateSeedreamDemo(
    "完整设计页面",
    { width: 1242, height: 1660 },
    [
      { file_name: "style.jpg", data_url: "data:image/jpeg;base64,AA", input_kind: "style" },
      { file_name: "ip.png", data_url: "data:image/png;base64,BB", input_kind: "asset" },
    ],
    { taskId: "TK-0001", pageIndex: 2, pageCount: 3 },
    "uat-jwt-token",
    fetcher,
  );

  assert.equal(capturedUrl, SEEDREAM_DEMO_PROXY_URL);
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer uat-jwt-token");
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.action, "seedream.generate");
  assert.equal(body.task_id, "TK-0001");
  assert.equal(body.page_index, 2);
  assert.equal(body.page_count, 3);
  assert.equal(body.images.length, 2);
  assert.equal(output.provider, "seedream");
  assert.equal(output.storage_path, "uat-seedream-outputs/TK-0001/page-02.jpg");
  assert.equal(output.target_size, "1242x1660");
});

test("Seedream Final uses the same UAT Ark gateway and Seedream model", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (url: any, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({
      ok: true,
      provider: "seedream",
      model: "doubao-seedream-4-0-250828",
      image_url: "https://example.com/final.jpg",
      storage_path: "uat-seedream-outputs/TK-0001/page-01-final.jpg",
      provider_requested_size: "1728x2304",
      actual_size: "1728x2304",
      input_image_count: 2,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const output = await generateSeedreamFinal(
    "正式成品",
    { width: 1242, height: 1660 },
    [
      { file_name: "confirmed-demo.jpg", data_url: "https://example.com/demo.jpg", input_kind: "style" },
      { file_name: "logo.png", data_url: "data:image/png;base64,BB", input_kind: "asset" },
    ],
    { taskId: "TK-0001", pageIndex: 1, pageCount: 3 },
    "uat-jwt-token",
    fetcher,
  );

  assert.equal(capturedUrl, SEEDREAM_DEMO_PROXY_URL);
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.action, "seedream.generate");
  assert.equal(body.task_id, "TK-0001");
  assert.equal(body.images.length, 2);
  assert.equal(output.model, "doubao-seedream-4-0-250828");
  assert.equal(output.image_url, "https://example.com/final.jpg");
});

test("Seedream gateway errors are surfaced", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ ok: false, error: "ARK_API_KEY_MISSING" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(
    () => generateSeedreamDemo("prompt", { width: 1242, height: 1660 }, [], { taskId: "TK", pageIndex: 1, pageCount: 1 }, "jwt", fetcher),
    /ARK_API_KEY_MISSING/,
  );
});
