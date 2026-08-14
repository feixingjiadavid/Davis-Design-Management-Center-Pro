import assert from "node:assert/strict";
import test from "node:test";
import { buildRequirementPrompt, extractExplicitDesignScope } from "./requirement-prompt.ts";

test("instructs DeepSeek with every required JSON field and an output example", () => {
  const prompt = buildRequirementPrompt({ id: "TK-1" }, [], []);
  for (const key of ["goal", "success_criteria", "deliverables", "pages", "facts", "confidence", "clarification_questions", "template_recommendations"]) {
    assert.match(prompt, new RegExp(`"${key}"`));
  }
  assert.match(prompt, /严格输出以下 JSON 对象结构/);
});

test("treats 小蓝书 as a fixed 1242x1660 business preset", () => {
  const prompt = buildRequirementPrompt({ id: "TK-1", channels: ["小蓝书"] }, [], []);
  assert.match(prompt, /小蓝书/);
  assert.match(prompt, /1242x1660px/);
  assert.match(prompt, /不得追问尺寸/);
});

test("extracts explicit multi-page design scope instead of mixing article/comment content", () => {
  const source = `【正文】\n魔法指令\n联系人\n【评论区置顶】\n更多说明\n—————————————分割线，以下是小蓝书配图，已制作完成———————————\n【图片】\n第 1 页 · 封面\n封面文案\n第 2 页 · 规则\n规则文案\n第 3 页 · 另外两条赛道\n赛道文案`;
  const scope = extractExplicitDesignScope(source);
  assert.ok(scope);
  assert.match(scope.text, /第 1 页 · 封面/);
  assert.match(scope.text, /第 3 页 · 另外两条赛道/);
  assert.doesNotMatch(scope.text, /魔法指令/);
  assert.doesNotMatch(scope.text, /联系人/);
});

test("does not expose out-of-scope full article text when explicit design scope exists", () => {
  const prompt = buildRequirementPrompt(
    { id: "TK-1", channels: ["小蓝书"] },
    [{
      id: "source-1",
      sourceType: "tencent_doc",
      document: {
        title: "doc",
        plainText: `【正文】\n魔法指令XYZ\n联系人ABC\n————————分割线，以下是小蓝书配图，已制作完成————————\n【图片】\n第 1 页 · 封面\n封面文案\n第 2 页 · 规则\n规则文案\n第 3 页 · 其他赛道\n赛道文案`,
        structuredBlocks: [], imageObservations: [], contentSha256: "x",
        counts: { characterCount: 1, tableCount: 0, imageCount: 0, attachmentCount: 0 },
      },
    }],
    [],
  );
  assert.match(prompt, /DESIGN_SCOPE_PRIORITY=EXPLICIT/);
  assert.doesNotMatch(prompt, /魔法指令XYZ/);
  assert.doesNotMatch(prompt, /联系人ABC/);
  assert.match(prompt, /第 1 页 · 封面/);
  assert.match(prompt, /第 3 页 · 其他赛道/);
});

test("treats Qwen visual analysis as the authoritative style observation", () => {
  const prompt = buildRequirementPrompt({
    id: "TK-1",
    channels: ["小蓝书"],
    visual_reference_analysis: {
      style_summary: "复古杂志拼贴风",
      typography_style: ["超粗黑体", "白色描边", "不规则贴纸标题"],
      composition_patterns: ["黑白主体与高饱和彩色纸片叠加"],
      avoid_copying: ["不复用参考图具体人物和文字"],
    },
  }, [], []);
  assert.match(prompt, /千问视觉/);
  assert.match(prompt, /复古杂志拼贴风/);
  assert.match(prompt, /超粗黑体/);
  assert.match(prompt, /不复用参考图具体人物和文字/);
});

test("marks explicit design scope as authoritative and requires one structured page per source page", () => {
  const prompt = buildRequirementPrompt(
    { id: "TK-1", channels: ["小蓝书"] },
    [{
      id: "source-1",
      sourceType: "tencent_doc",
      document: {
        title: "doc",
        plainText: `【正文】\n魔法指令\n————————分割线，以下是小蓝书配图，已制作完成————————\n【图片】\n第 1 页 · 封面\n封面文案\n第 2 页 · 规则\n规则文案\n第 3 页 · 其他赛道\n赛道文案`,
        structuredBlocks: [], imageObservations: [], contentSha256: "x",
        counts: { characterCount: 1, tableCount: 0, imageCount: 0, attachmentCount: 0 },
      },
    }],
    [],
  );
  assert.match(prompt, /DESIGN_SCOPE_PRIORITY=EXPLICIT/);
  assert.match(prompt, /不得把作用域之外的正文、评论区、联系人、链接、魔法指令自动塞进设计页/);
  assert.match(prompt, /pages 必须与 DESIGN_SCOPE 中的页数一一对应/);
  assert.match(prompt, /每页 copy 只能来自该页对应内容/);
});
