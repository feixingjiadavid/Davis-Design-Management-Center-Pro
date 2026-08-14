import assert from "node:assert/strict";
import test from "node:test";
import { assertCanGenerateDemo, assertCanGenerateFinal, executeIdempotent, resolveDemoSize, selectGenerationPages, selectModelReferences, selectModelInputs, demoPagePrompt, composeDeterministicDemo } from "./generation-service.ts";

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

test("uses structured pages as one Demo per requested page", () => {
  const pages = selectGenerationPages({
    pages: [
      { index: 1, title: "封面", copy: ["A"] },
      { index: 2, title: "规则", copy: ["B"] },
      { index: 3, title: "其他赛道", copy: ["C"] },
    ],
    deliverables: [{ type: "小蓝书宣传配图", quantity: 3 }],
  });
  assert.equal(pages.length, 3);
  assert.equal(pages[1].title, "规则");
});

test("puts the primary style reference first and caps legacy model references at four", () => {
  const refs = selectModelReferences([
    { id: "a", is_primary: false, sort_order: 0 },
    { id: "b", is_primary: false, sort_order: 1 },
    { id: "c", is_primary: true, sort_order: 2 },
    { id: "d", is_primary: false, sort_order: 3 },
    { id: "e", is_primary: false, sort_order: 4 },
  ] as any[]);
  assert.deepEqual(refs.map((item) => item.id), ["c", "a", "b", "d"]);
});

test("sends only one style reference plus up to three required assets to the image model", () => {
  const inputs = selectModelInputs(
    [
      { id: "style-a", is_primary: false, sort_order: 0 },
      { id: "style-main", is_primary: true, sort_order: 1 },
      { id: "style-b", is_primary: false, sort_order: 2 },
    ] as any[],
    [
      { id: "asset-ip", asset_role: "TIG IP", sort_order: 0 },
      { id: "asset-logo", asset_role: "Logo", sort_order: 1 },
      { id: "asset-photo", asset_role: "人物照片", sort_order: 2 },
      { id: "asset-extra", asset_role: "其他", sort_order: 3 },
    ] as any[],
  );
  assert.deepEqual(inputs.map((item: any) => item.id), ["style-main", "asset-ip", "asset-logo", "asset-photo"]);
});

test("page prompt tells the image model to render no text and treats style/asset images differently", () => {
  const prompt = demoPagePrompt(
    { goal: "做3页", visual_direction: ["年轻科技感"], constraints: ["1242x1660"], recommendations: [] },
    { index: 2, title: "SKILL新锐规则", copy: ["当月TOP1 10000元豆", "TOP2~10 各5000元豆"] },
    [{ file_name: "style.jpg", note: "参考配色", is_primary: true } as any],
    [{ file_name: "tiger.png", asset_role: "TIG IP", note: "必须使用" } as any],
  );
  assert.match(prompt, /SKILL新锐规则/);
  assert.match(prompt, /当月TOP1 10000元豆/);
  assert.match(prompt, /风格参考/);
  assert.match(prompt, /必用素材/);
  assert.match(prompt, /禁止生成任何可读文字/);
});

test("deterministic compositor preserves exact Chinese copy and exact required asset image", () => {
  const output = composeDeterministicDemo(
    { image_url: "data:image/png;base64,AAAA", provider: "cloudflare", model: "demo" },
    { width: 1242, height: 1660 },
    { index: 1, title: "封面", copy: ["2026 TIG 合作社·达人激励计划", "SKILL 新锐 上架就有豆", "单月 TOP1 直接拿 10000 元豆"] },
    [{ file_name: "tiger.png", data_url: "data:image/png;base64,BBBB", asset_role: "TIG IP" } as any],
    { visual_reference_analysis: { style_keywords: ["复古拼贴"] } },
  );
  assert.match(output.image_url, /^data:image\/svg\+xml;base64,/);
  assert.equal(output.text_rendering, "deterministic_svg");
  assert.equal(output.asset_count, 1);
});
