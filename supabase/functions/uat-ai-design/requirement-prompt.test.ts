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
