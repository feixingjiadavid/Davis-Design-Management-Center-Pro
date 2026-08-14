import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCanGenerateDemo,
  assertCanGenerateFinal,
  demoPagePrompt,
  executeIdempotent,
  isReusableSeedreamDemo,
  resolveDemoSize,
  selectGenerationPages,
  selectModelInputs,
  selectModelReferences,
  SEEDREAM_DEMO_PROMPT_VERSION,
} from "./generation-service.ts";
import { SEEDREAM_DEMO_MODEL } from "./seedream-client.ts";

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

test("uses structured pages as one Demo per requested page", () => {
  const pages = selectGenerationPages({
    pages: [
      { index: 1, title: "封面", copy: ["A"] },
      { index: 2, title: "规则", copy: ["B"] },
    ],
    deliverables: [{ type: "宣传配图", quantity: 2 }],
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[1].title, "规则");
});

test("puts the primary style reference first", () => {
  const refs = selectModelReferences([
    { id: "a", is_primary: false, sort_order: 0 },
    { id: "main", is_primary: true, sort_order: 2 },
    { id: "b", is_primary: false, sort_order: 1 },
  ] as any[]);
  assert.deepEqual(refs.map((item) => item.id), ["main", "a", "b"]);
});

test("sends one primary style reference plus up to nine required assets", () => {
  const assets = Array.from({ length: 12 }, (_, index) => ({ id: `asset-${index}`, sort_order: index }));
  const inputs = selectModelInputs(
    [{ id: "style-main", is_primary: true, sort_order: 0 }] as any[],
    assets as any[],
  );
  assert.equal(inputs.length, 10);
  assert.equal((inputs[0] as any).id, "style-main");
  assert.deepEqual(inputs.slice(1).map((item: any) => item.id), assets.slice(0, 9).map((item) => item.id));
});

test("design-director prompt requests one complete page and blocks semantic copying", () => {
  const prompt = demoPagePrompt(
    {
      goal: "做企业内部活动宣传海报",
      audience: ["企业内部员工"],
      success_criteria: ["高级专业", "信息清晰"],
      visual_direction: ["蓝色科技感", "荣誉感"],
      layout_plan: ["主标题优先", "IP作为点睛"],
      constraints: ["1242x1660px"],
      recommendations: [{ value: "留白充足" }],
      visual_reference_analysis: {
        style_summary: "复古拼贴",
        style_keywords: ["撕纸", "高对比"],
        avoid_copying: ["参考图人物", "参考图标题"],
      },
    },
    { index: 1, title: "荣誉体系", copy: ["2026 TIG 合作社", "人人都是超级个体"] },
    [{ file_name: "style.jpg", note: "只参考视觉语言", is_primary: true, data_url: "data:image/jpeg;base64,AA" }],
    [{ file_name: "IP.png", asset_role: "TIG IP", note: "保持形象", data_url: "data:image/png;base64,BB" }],
  );
  assert.match(prompt, /完整设计 Demo 页面/);
  assert.match(prompt, /2026 TIG 合作社/);
  assert.match(prompt, /人人都是超级个体/);
  assert.match(prompt, /严禁照搬/);
  assert.match(prompt, /机械地逐个贴进画面/);
  assert.match(prompt, /TIG IP/);
  assert.match(prompt, /Logo通常是品牌签名/);
  assert.match(prompt, /输出必须是一张完整可评审的设计页面/);
});

test("only current Seedream model and prompt version are reusable", () => {
  const base = { kind: "demo", status: "ready", model: SEEDREAM_DEMO_MODEL, prompt_version: SEEDREAM_DEMO_PROMPT_VERSION };
  assert.equal(isReusableSeedreamDemo(base), true);
  assert.equal(isReusableSeedreamDemo({ ...base, model: "@cf/flux" }), false);
  assert.equal(isReusableSeedreamDemo({ ...base, prompt_version: "demo-style-assets-exact-text-v3" }), false);
  assert.equal(isReusableSeedreamDemo({ ...base, status: "failed" }), false);
});
