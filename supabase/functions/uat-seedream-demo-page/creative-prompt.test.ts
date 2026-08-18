import assert from "node:assert/strict";
import test from "node:test";
import { buildCreativeDemoPrompt, DEMO_PROMPT_VERSION } from "./creative-prompt.ts";

test("creative prompt version is isolated from the old placement-first Demo", () => {
  assert.equal(DEMO_PROMPT_VERSION, "seedream-demo-creative-director-v2");
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
  assert.ok(prompt.indexOf("先建立一个明确的视觉创意概念") < prompt.indexOf("【本页必须呈现的业务文案】"));
  assert.match(prompt, /封面不是正文信息页/);
  assert.match(prompt, /至少三层空间关系/);
  assert.match(prompt, /IP必须与场景、道具、文字或图形发生关系/);
  assert.match(prompt, /禁止.*横向色带|禁止.*色块分区/);
  assert.match(prompt, /像资深设计师完成的主视觉/);
  assert.ok(prompt.length <= 4500);
});

test("cover renders only the first six priority lines and keeps overflow as non-rendered context", () => {
  const copy = Array.from({ length: 10 }, (_, index) => `封面文案${index + 1}`);
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "活动海报", layout_plan: ["第1页（封面）：主标题优先"] },
    page: { index: 1, title: "封面页", copy },
    styleReference: { file_name: "ref.jpg" },
    assets: [],
  });
  assert.match(prompt, /【本页必须呈现的业务文案】[\s\S]*封面文案6/);
  assert.doesNotMatch(prompt.match(/【本页必须呈现的业务文案】[\s\S]*?【仅作理解上下文，不要在封面重复排版】/)?.[0] || "", /封面文案7/);
  assert.match(prompt, /【仅作理解上下文，不要在封面重复排版】[\s\S]*封面文案7/);
  assert.match(prompt, /封面文案10/);
});

test("non-cover information pages keep all supplied page copy as renderable content", () => {
  const prompt = buildCreativeDemoPrompt({
    brief: { goal: "活动海报" },
    page: { index: 2, title: "规则页", copy: ["规则A", "规则B", "规则C"] },
    styleReference: { file_name: "ref.jpg" },
    assets: [],
  });
  assert.match(prompt, /【本页必须呈现的业务文案】[\s\S]*规则A[\s\S]*规则B[\s\S]*规则C/);
  assert.doesNotMatch(prompt, /仅作理解上下文/);
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
  assert.match(prompt, /保持身份特征/);
  assert.match(prompt, /不得复制参考图中的具体人物、品牌、标题或物体/);
});
