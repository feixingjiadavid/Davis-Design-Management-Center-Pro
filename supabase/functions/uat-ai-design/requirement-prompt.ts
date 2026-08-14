import type { NormalizedSourceDocument } from "./source-types.ts";

export const REQUIREMENT_PROMPT_VERSION = "requirement-grounded-v2";

export function buildRequirementPrompt(
  task: Record<string, unknown>,
  sources: Array<{ id: string; sourceType: string; document: NormalizedSourceDocument }>,
  templates: Array<Record<string, unknown>>,
) {
  const sourceText = sources.map((source) => [
    `SOURCE_ID=${source.id}`,
    `SOURCE_TYPE=${source.sourceType}`,
    `TITLE=${source.document.title}`,
    source.document.plainText.slice(0, 60_000),
  ].join("\n")).join("\n\n---\n\n");
  return `你是企业内部专业视觉设计需求分析师。只依据提供的来源判断事实，不得脑补。

系统业务规格（属于确定规则，不是 AI 建议）：
- 当任务渠道包含“小蓝书”时，画布尺寸固定为 1242x1660px。必须直接把“1242x1660px”写入 dimensions，不得追问尺寸。
- 如果需求方另有明确尺寸要求，以需求方明确写出的尺寸为准。

规则：
1. 每条事实必须填写 source_id 和可以让人定位的 locator。
2. 推断、审美判断和方案建议必须放入 recommendations，label 固定为“AI建议”。
3. 缺少尺寸、完整文案、数量、关键素材、明确产出类型或截止时间时，写入 missing_information 并提出具体问题；但系统业务规格已经确定的字段不属于缺失信息，不得追问。
4. 来源互相矛盾时写入 conflicts，不得自行选择其中一个。
5. OpenTalk 必须先判断是“预告”还是“回顾”，只能推荐同类型模板。
6. 必须阅读并理解来源全文；完整正文保留在来源快照，copy 仅提取设计中必须直接呈现的标题、关键文案与规则要点，不要整篇复述。

严格输出以下 JSON 对象结构，必须保留全部字段；没有内容的列表填写 []，未知截止日期填写空字符串：
${JSON.stringify({
  goal: "一句话说明设计目标",
  success_criteria: ["验收标准"],
  audience: ["目标受众"],
  deliverables: [{ type: "产出类型", quantity: 1 }],
  channels: ["投放渠道"],
  dimensions: ["画布尺寸"],
  copy: ["必须保留的文案"],
  visual_direction: ["视觉方向"],
  layout_plan: ["版式/页面规划"],
  required_assets: ["所需素材"],
  constraints: ["限制条件"],
  deadline: "YYYY-MM-DD 或空字符串",
  facts: [{ key: "事实字段", value: "事实值", source_type: "form_fields 或 tencent_doc", source_id: "来源 ID", locator: "需求单字段名或文档定位" }],
  recommendations: [{ value: "建议内容", label: "AI建议" }],
  missing_information: ["缺失信息"],
  conflicts: ["来源冲突"],
  risks: ["执行风险"],
  confidence: 0.8,
  clarification_questions: ["需要需求方回答的具体问题"],
  template_recommendations: [{ template_id: "仅使用可选模板中真实存在的 ID", reason: "匹配原因" }],
}, null, 2)}

任务记录：
${JSON.stringify(task)}

可选模板：
${JSON.stringify(templates)}

已验证来源：
${sourceText}`;
}
