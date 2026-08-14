import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRequirementContent, proxyDeepSeekRequirement } from "./proxy-service.ts";

test("validates the UAT JWT before calling DeepSeek", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await proxyDeepSeekRequirement({ prompt: "分析需求", model: "deepseek-v4-flash", jwt: "uat-jwt", apiKey: "deepseek-key" }, async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/auth/v1/user")) return Response.json({ email: "uat.requester@webank.com" });
    return Response.json({ choices: [{ message: { content: "{\"goal\":\"真实理解\"}" }, finish_reason: "stop" }], usage: { total_tokens: 12 } });
  });
  assert.match(calls[0].url, /bjzfkwxrvytgphvgwltl\.supabase\.co\/auth\/v1\/user/);
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer uat-jwt");
  assert.equal(calls[1].url, "https://api.deepseek.com/chat/completions");
  assert.equal(new Headers(calls[1].init?.headers).get("authorization"), "Bearer deepseek-key");
  assert.equal(result.content, "{\"goal\":\"真实理解\"}");
});

test("normalizes object-shaped required_assets into the UAT string-array contract", () => {
  const normalized = JSON.parse(normalizeRequirementContent(JSON.stringify({
    goal: "x",
    required_assets: [
      { asset_role: "TIG IP 虎", file_name: "IP.png", status: "已提供", note: "保持形象特征一致" },
      { role: "公司彩色logo", filename: "WeBank.png", provided: true, usage: "浅色底使用" },
    ],
  })));
  assert.deepEqual(normalized.required_assets, [
    "已提供：TIG IP 虎 / IP.png（保持形象特征一致）",
    "已提供：公司彩色logo / WeBank.png（浅色底使用）",
  ]);
});

test("preserves already-valid string required_assets", () => {
  const normalized = JSON.parse(normalizeRequirementContent(JSON.stringify({ required_assets: ["已提供：TIG IP / IP.png"] })));
  assert.deepEqual(normalized.required_assets, ["已提供：TIG IP / IP.png"]);
});

test("rejects callers outside the UAT AI whitelist", async () => {
  await assert.rejects(() => proxyDeepSeekRequirement({ prompt: "x", model: "deepseek-v4-flash", jwt: "jwt", apiKey: "key" }, async () => Response.json({ email: "outsider@example.com" })), /UAT_CALLER_FORBIDDEN/);
});

test("rejects missing formal-project DeepSeek secret", async () => {
  await assert.rejects(() => proxyDeepSeekRequirement({ prompt: "x", model: "deepseek-v4-flash", jwt: "jwt", apiKey: "" }), /DEEPSEEK_PROXY_NOT_CONFIGURED/);
});
