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
  assert.ok(prompt.indexOf("先建立一个明确的视觉创意概念") < prompt.indexOf("【本页业务文案】"));
  assert.match(prompt, /封面不是正文信息页/);
  assert.match(prompt, /至少三层空间关系/);
  assert.match(prompt, /IP必须与场景、道具、文字或图形发生关系/);
  assert.match(prompt, /禁止.*横向色带|禁止.*色块分区/);
  assert.match(prompt, /像资深设计师完成的主视觉/);
  assert.ok(prompt.length <= 4500);
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
