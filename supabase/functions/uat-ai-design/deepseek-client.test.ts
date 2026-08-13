import assert from "node:assert/strict";
import test from "node:test";
import { callDeepSeekRequirementModel } from "./deepseek-client.ts";

const validBrief = {
  goal: "制作 TIG 合作社宣传页",
  success_criteria: ["完整呈现规则"],
  audience: ["内部员工"],
  deliverables: [{ type: "平面视觉", quantity: 2 }],
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

test("rejects missing DeepSeek configuration", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "", model: "deepseek-v4-flash" }), /DEEPSEEK_MODEL_NOT_CONFIGURED/);
});

test("reports DeepSeek HTTP errors", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => new Response("rate limited", { status: 429 })), /DEEPSEEK_HTTP_429/);
});

test("rejects empty, truncated, and invalid JSON responses", async () => {
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "" }, finish_reason: "stop" }] })), /DEEPSEEK_EMPTY_RESPONSE/);
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "length" }] })), /DEEPSEEK_RESPONSE_TRUNCATED/);
  await assert.rejects(() => callDeepSeekRequirementModel("prompt", { apiKey: "key", model: "deepseek-v4-flash" }, async () => Response.json({ choices: [{ message: { content: "not-json" }, finish_reason: "stop" }] })), /DEEPSEEK_INVALID_JSON/);
});
