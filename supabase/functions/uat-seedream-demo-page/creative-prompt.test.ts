import assert from "node:assert/strict";
import test from "node:test";
import { buildCreativeDemoPrompt, DEMO_PROMPT_VERSION } from "./creative-prompt.ts";

test("creative prompt version is isolated from the old placement-first Demo", () => {
  assert.equal(DEMO_PROMPT_VERSION, "seedream-brand-safe-creative-v3");
});

test("cover prompt puts concept and composition rules before business copy", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: {
      goal: "2026 TIG合作社达人激励计划",
      visual_direction: ["复古拼贴", "撕纸", "高饱和对比"],
      layout_plan: ["第1页（封面）：大标题作为绝对视觉重心，IP虎置于中下部，标签环绕"],
      constraints: ["Logo不得变形"],
      visual_reference_analysis: {
        style_summary: "复古拼贴艺术风格",
        composition_patterns: ["中心聚焦", "错位叠加"],
        texture_materials: ["撕纸", "噪点"],
        hierarchy_rules: ["大标题占据视觉重心"],
      },
    },
    page: { index: 1, title: "封面页", copy: ["2026 TIG 合作社 · 达人激励计划", "SKILL新锐 上架就有豆", "单月 TOP1 直接拿 10000 元豆", "今年 TIG 合作社 3 大激励赛道"] },
    styleReference: { file_name: "style.jpg", note: "主参考" },
    assets: [{ file_name: "IP.png", asset_role: "TIG IP" }, { file_name: "logo.png", asset_role: "WeBank Logo" }],
  });
  assert.ok(prompt.indexOf("先形成一个完整创意场景") < prompt.indexOf("【信息架构：内容完整，但必须设计出主次】"));
  assert.match(prompt, /这是封面主视觉/);
  assert.match(prompt, /背景氛围层.*中景信息与道具层.*前景主角层/);
  assert.match(prompt, /IP必须参与场景/);
  assert.match(prompt, /禁止三条横向色带/);
  assert.match(prompt, /成熟品牌活动海报/);
  assert.ok(prompt.length <= 4800);
});

test("cover renders only the first six priority lines and keeps overflow as non-rendered context", () => {
  const copy = Array.from({ length: 10 }, (_, index) => `封面文案${index + 1}`);
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "活动海报", layout_plan: ["第1页（封面）：主标题优先"] },
    page: { index: 1, title: "封面页", copy },
    styleReference: { file_name: "ref.jpg" },
    assets: [],
  });
  assert.match(prompt, /【辅助信息】[\s\S]*封面文案6/);
  assert.doesNotMatch(prompt.match(/【辅助信息】[\s\S]*?【后续上下文/)?.[0] || "", /封面文案7/);
  assert.match(prompt, /【后续上下文（当前页弱化）】[\s\S]*封面文案7/);
  assert.match(prompt, /封面文案10/);
});

test("non-cover information pages keep all supplied page copy as renderable content", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "活动海报" },
    page: { index: 2, title: "规则页", copy: ["规则A", "规则B", "规则C"] },
    styleReference: { file_name: "ref.jpg" },
    assets: [],
  });
  assert.match(prompt, /【信息架构：内容完整，但必须设计出主次】[\s\S]*规则A[\s\S]*规则B[\s\S]*规则C/);
  assert.doesNotMatch(prompt, /后续上下文/);
});

test("prompt keeps required asset identities and reference style separate", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "活动海报", visual_reference_analysis: { style_summary: "纸张拼贴" } },
    page: { index: 2, title: "规则页", copy: ["TOP1 10000元豆"] },
    styleReference: { file_name: "ref.jpg" },
    assets: [{ file_name: "IP.png", asset_role: "TIG IP" }],
  });
  assert.match(prompt, /图1是风格参考/);
  assert.match(prompt, /TIG IP/);
  assert.match(prompt, /保持原始身份与外观/);
  assert.match(prompt, /不要复制参考图的具体人物.*Logo或原文案/);
});

test("cultural P1 reserves system brand areas and excludes logo assets", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "OpenTalk" },
    page: { index: 1, title: "封面页", copy: ["OpenTalk"] },
    styleReference: { file_name: "ref.jpg" },
    assets: [
      { file_name: "wesmart.svg", asset_role: "WeSmart Logo" },
      { file_name: "speaker.jpg", asset_role: "嘉宾照片" },
    ],
    brandPlan: {
      creativeArea: { x: 0, y: 220, width: 1242, height: 1260 },
      safeArea: { top_left_reserved: true, bottom_reserved: true },
      pageRule: { apply_brand: true },
    },
  });
  assert.match(prompt, /只负责 Creative Area（x=0, y=220, 1242×1260）/);
  assert.match(prompt, /leave clean space at top left for brand logo/);
  assert.match(prompt, /leave clean space at bottom for organization logo/);
  assert.doesNotMatch(prompt, /图\d+：WeSmart Logo/);
  assert.match(prompt, /图2：嘉宾照片/);
  assert.match(prompt, /禁止绘制、临摹、拼写或修改任何Logo/);
});

test("P2 and later pages explicitly forbid model-generated logos", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "文化活动" },
    page: { index: 2, title: "内容页", copy: ["内容"] },
    styleReference: null,
    assets: [],
    brandPlan: {
      creativeArea: { x: 0, y: 0, width: 1242, height: 1660 },
      safeArea: { top_left_reserved: false, bottom_reserved: false },
      pageRule: { apply_brand: false, forbidden_asset_types: ["wesmart_logo", "tig_org_logo"] },
    },
  });
  assert.match(prompt, /当前页禁止出现任何Logo/);
  assert.doesNotMatch(prompt, /leave clean space at top left/);
});
