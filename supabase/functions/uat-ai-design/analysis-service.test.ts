import assert from "node:assert/strict";
import test from "node:test";
import { assertUnderstandingCanBeConfirmed, decideAnalysisStatus, selectCurrentTaskSources, selectOpenTalkTemplates } from "./analysis-service.ts";
import { validateRequirementBrief } from "./requirement-schema.ts";

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
  facts: [{ key: "dimension", value: "1242×1660", source_type: "tencent_doc", source_id: "source-1", locator: "表格/尺寸" }],
  recommendations: [{ value: "采用蓝色科技风", label: "AI建议" }],
  missing_information: [],
  conflicts: [],
  risks: [],
  confidence: 0.91,
  clarification_questions: [],
  template_recommendations: [{ template_id: "template-1", reason: "信息结构匹配" }],
};

test("rejects a requirement brief whose facts have no source locator", () => {
  const invalid = structuredClone(validBrief);
  invalid.facts[0].locator = "";
  assert.throws(() => validateRequirementBrief(invalid), /FACT_CITATION_REQUIRED/);
});

test("requires clarification when critical information is missing", () => {
  const brief = structuredClone(validBrief);
  brief.missing_information = ["最终尺寸"];
  brief.clarification_questions = ["最终画布尺寸是多少？"];
  assert.equal(decideAnalysisStatus(brief), "clarification_required");
});

test("does not block when a historical conflict has already been resolved by precedence", () => {
  const brief = structuredClone(validBrief);
  brief.conflicts = ["历史回答要求展示联系人，但当前显式设计作用域优先，因此本次不展示。"];
  brief.missing_information = [];
  brief.clarification_questions = [];
  assert.equal(decideAnalysisStatus(brief), "understanding_ready");
});

test("marks a complete grounded brief ready for confirmation", () => {
  assert.equal(decideAnalysisStatus(validBrief), "understanding_ready");
});

test("separates OpenTalk announcement and recap templates", () => {
  const templates = [
    { id: "announcement", template_family: "OpenTalk", template_type: "预告" },
    { id: "recap", template_family: "OpenTalk", template_type: "回顾" },
  ];
  assert.deepEqual(selectOpenTalkTemplates(templates, "预告").map((item) => item.id), ["announcement"]);
  assert.deepEqual(selectOpenTalkTemplates(templates, "回顾").map((item) => item.id), ["recap"]);
});

test("blocks understanding confirmation while clarification remains open", () => {
  assert.throws(() => assertUnderstandingCanBeConfirmed("understanding_ready", 1), /OPEN_CLARIFICATIONS_REMAIN/);
  assert.doesNotThrow(() => assertUnderstandingCanBeConfirmed("understanding_ready", 0));
});

test("uses only the Tencent source from the task's current link", () => {
  const rows = [
    { id: "form", source_type: "form_fields", source_url: null },
    { id: "old", source_type: "tencent_doc", source_url: "https://docs.qq.com/doc/old" },
    { id: "current", source_type: "tencent_doc", source_url: "https://docs.qq.com/doc/current" },
  ];
  assert.deepEqual(
    selectCurrentTaskSources(rows, "https://docs.qq.com/doc/current").map((row) => row.id),
    ["form", "current"],
  );
});
