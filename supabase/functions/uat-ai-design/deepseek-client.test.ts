import assert from "node:assert/strict";
import test from "node:test";
import { callDeepSeekRequirementModel } from "./deepseek-client.ts";

const validBrief = {
  goal: "制作 TIG 合作社宣传页",
  success_criteria: ["完整呈现规则"],
  audience: ["内部员工"],
  deliverables: [{ type: "平面视觉", quantity: 2 }],
  pages: [
    { index: 1, title: "封面", copy: ["2026 TIG 合作社"] },
    { index: 2, title: "规则", copy: ["完整呈现规则"] },
  ],
  channels: ["小蓝书"],
  dimensions: ["1242×1660"],
  copy: ["2026 TIG 合作社"],
  visual_direction: ["科技感"],
  layout_plan: ["主宣传页", "规则介绍页"],
  required_assets: [],
  constraints: ["正文不可删减"],
  deadline: "2026-08-21",
  facts: [{ key: "dimension", value: "1242×1660", source_type: "form_fields", source_id: "source-1", locator: "需求单/尺寸" }],
  recommendations: [{ value: "采用蓝色科技风", label: "AI建议" }],
  missing_information: [],
  conflicts: [],
  risks: [],
  confidence: 0.91,
  clarification_questions: [],
  template_recommendations: [],
};

test("sends a DeepSeek JSON Output request and validates the brief", async () => {
  let request: Request | undefined;
  const result = await callDeepSeekRequirementModel("分析需求", {
    apiKey: "test-secret",
    model: "deepseek-v4-flash",
  }, async (input, init) => {
    request = new Request(input, init);
    return Response.json({ choices: [{ message: { content: JSON.stringify(validBrief) }, finish_reason: "stop" }], usage: { total_tokens: 123 } });
  });
  assert.equal(request?.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request?.headers.get("authorization"), "Bearer test-secret");
  const body = JSON.parse(await request!.clone().text());
  assert.equal(body.model, "deepseek-v4-flash");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.stream, false);
  assert.equal(result.brief.goal, validBrief.goal);
  assert.equal(result.usage.total_tokens, 123);
});

test("normalizes structured required assets instead of failing the whole analysis", async () => {
  const structured = {
    ...validBrief,
    required_assets: [
      { asset_role: "TIG IP 虎", file_name: "IP.png", status: "已提供", note: "保持形象特征一致" },
      { role: "公司彩色Logo", filename: "WeBank logo 彩色英文Logo.png", provided: true, usage: "浅色底使用" },
    ],
  };
  const result = await callDeepSeekRequirementModel("分析需求", {
    apiKey: "test-secret",
    model: "deepseek-v4-flash",
  }, async () => Response.json({ choices: [{ message: { content: JSON.stringify(structured) }, finish_reason: "stop" }] }));
  assert.equal(result.brief.required_assets.length, 2);
  assert.match(result.brief.required_assets[0], /TIG IP 虎/);
  assert.match(result.brief.required_assets[0], /IP\.png/);
  assert.match(result.brief.required_assets[1], /公司彩色Logo/);
});

test("rejects missing DeepSeek configuration", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "", model: "deepseek-v4-flash" }), /DEEPSEEK_MODEL_NOT_CONFIGURED/);
});

test("reports DeepSeek HTTP errors", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => new Response("rate limited", { status: 429 })), /DEEPSEEK_HTTP_429/);
});

test("uses the authorized formal-project proxy when no local API key is present", async () => {
  let request: Request | undefined;
  const result = await callDeepSeekRequirementModel("分析需求", {
    apiKey: "",
    model: "deepseek-v4-flash",
    proxyUrl: "https://formal.supabase.co/functions/v1/uat-deepseek-proxy",
    userJwt: "uat-jwt",
  }, async (input, init) => {
    request = new Request(input, init);
    return Response.json({ ok: true, content: JSON.stringify(validBrief), usage: { total_tokens: 88 } });
  });
  assert.equal(request?.headers.get("authorization"), "Bearer uat-jwt");
  assert.equal(result.brief.goal, validBrief.goal);
  assert.equal(result.usage.total_tokens, 88);
});

test("rejects empty, truncated, and invalid JSON responses", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "" }, finish_reason: "stop" }] })), /DEEPSEEK_EMPTY_RESPONSE/);
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "length" }] })), /DEEPSEEK_RESPONSE_TRUNCATED/);
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "not-json" }, finish_reason: "stop" }] })), /DEEPSEEK_INVALID_JSON/);
});
