import assert from "node:assert/strict";
import test from "node:test";
import { buildRequirementPrompt } from "./requirement-prompt.ts";

test("instructs DeepSeek with every required JSON field and an output example", () => {
  const prompt = buildRequirementPrompt({ id: "TK-1" }, [], []);
  for (const key of ["goal", "success_criteria", "deliverables", "facts", "confidence", "clarification_questions", "template_recommendations"]) {
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
