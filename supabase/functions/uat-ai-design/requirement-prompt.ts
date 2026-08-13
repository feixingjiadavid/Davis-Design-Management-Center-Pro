import type { NormalizedSourceDocument } from "./source-types.ts";

export const REQUIREMENT_PROMPT_VERSION = "requirement-grounded-v1";

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

规则：
1. 每条事实必须填写 source_id 和可以让人定位的 locator。
2. 推断、审美判断和方案建议必须放入 recommendations，label 固定为“AI建议”。
3. 缺少尺寸、完整文案、数量、关键素材、明确产出类型或截止时间时，写入 missing_information 并提出具体问题。
4. 来源互相矛盾时写入 conflicts，不得自行选择其中一个。
5. OpenTalk 必须先判断是“预告”还是“回顾”，只能推荐同类型模板。
6. 不允许删减来源中的正文。

任务记录：
${JSON.stringify(task)}

可选模板：
${JSON.stringify(templates)}

已验证来源：
${sourceText}`;
}
