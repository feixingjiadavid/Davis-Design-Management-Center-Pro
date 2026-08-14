import assert from "node:assert/strict";
import test from "node:test";
import { assertCanGenerateDemo, assertCanGenerateFinal, executeIdempotent, resolveDemoSize, selectGenerationPages, selectModelReferences, demoPagePrompt } from "./generation-service.ts";

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

test("puts the primary reference first and caps model references at four", () => {
  const refs = selectModelReferences([
    { id: "a", is_primary: false, sort_order: 0 },
    { id: "b", is_primary: false, sort_order: 1 },
    { id: "c", is_primary: true, sort_order: 2 },
    { id: "d", is_primary: false, sort_order: 3 },
    { id: "e", is_primary: false, sort_order: 4 },
  ] as any[]);
  assert.deepEqual(refs.map((item) => item.id), ["c", "a", "b", "d"]);
});

test("page prompt contains page copy and does not truncate into unrelated whole-brief text", () => {
  const prompt = demoPagePrompt(
    { goal: "做3页", visual_direction: ["年轻科技感"], constraints: ["1242x1660"], recommendations: [] },
    { index: 2, title: "SKILL新锐规则", copy: ["当月TOP1 10000元豆", "TOP2~10 各5000元豆"] },
    [{ file_name: "style.jpg", note: "参考配色", is_primary: true } as any],
  );
  assert.match(prompt, /SKILL新锐规则/);
  assert.match(prompt, /当月TOP1 10000元豆/);
  assert.match(prompt, /主参考/);
});
