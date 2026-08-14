import type { NormalizedSourceDocument } from "./source-types.ts";

export const REQUIREMENT_PROMPT_VERSION = "requirement-grounded-v6-qwen-vision";

export function extractExplicitDesignScope(text: string): { marker: string; text: string } | null {
  const normalized = String(text || "").replace(/\r/g, "");
  const explicitMarker = /[^\n]*(?:分割线[^\n]*)?(?:以下|下面)[^\n]*(?:小蓝书)?(?:配图|页面|海报|设计稿)[^\n]*\n/i.exec(normalized);
  let start = explicitMarker ? (explicitMarker.index + explicitMarker[0].length) : -1;
  let marker = explicitMarker?.[0]?.trim() || "";
  if (start >= 0) {
    const imageMarkerOffset = normalized.slice(start).search(/【图片】\s*\n?/);
    if (imageMarkerOffset >= 0 && imageMarkerOffset < 500) start += imageMarkerOffset;
  } else {
    const imageMarker = /【图片】\s*\n?/.exec(normalized);
    if (imageMarker) { start = imageMarker.index; marker = imageMarker[0].trim(); }
  }
  if (start < 0) return null;
  const scoped = normalized.slice(start).trim();
  const pageCount = (scoped.match(/第\s*\d+\s*页/g) || []).length;
  if (pageCount < 2) return null;
  return { marker, text: scoped };
}

export function buildRequirementPrompt(
  task: Record<string, unknown>,
  sources: Array<{ id: string; sourceType: string; document: NormalizedSourceDocument }>,
  templates: Array<Record<string, unknown>>,
) {
  const sourceText = sources.map((source) => {
    const scope = source.sourceType === "tencent_doc" ? extractExplicitDesignScope(source.document.plainText) : null;
    if (scope) {
      return [
        `SOURCE_ID=${source.id}`,
        `SOURCE_TYPE=${source.sourceType}`,
        `TITLE=${source.document.title}`,
        "DESIGN_SCOPE_PRIORITY=EXPLICIT",
        `DESIGN_SCOPE_MARKER=${scope.marker}`,
        "DESIGN_SCOPE_BEGIN",
        scope.text.slice(0, 40_000),
        "DESIGN_SCOPE_END",
        "FULL_SOURCE_CONTEXT=OMITTED_BECAUSE_EXPLICIT_DESIGN_SCOPE_EXISTS",
      ].join("\n");
    }
    return [
      `SOURCE_ID=${source.id}`,
      `SOURCE_TYPE=${source.sourceType}`,
      `TITLE=${source.document.title}`,
      "DESIGN_SCOPE_PRIORITY=NONE",
      "FULL_SOURCE_CONTEXT_BEGIN",
      source.document.plainText.slice(0, 60_000),
      "FULL_SOURCE_CONTEXT_END",
    ].join("\n");
  }).join("\n\n---\n\n");

  const visualAnalysis = (task.visual_reference_analysis && typeof task.visual_reference_analysis === "object")
    ? task.visual_reference_analysis
    : null;
  const visualAnalysisText = visualAnalysis
    ? `\n千问视觉已实际查看参考图，以下结果是视觉风格事实，可直接用于视觉方向判断：\nVISUAL_REFERENCE_ANALYSIS_BEGIN\n${JSON.stringify(visualAnalysis)}\nVISUAL_REFERENCE_ANALYSIS_END\n`
    : "\n当前没有千问视觉分析结果。不得假装看到了参考图像素内容。\n";

  return `你是企业内部专业视觉设计需求分析师。只依据提供的来源判断事实，不得脑补。

系统业务规格（属于确定规则，不是 AI 建议）：
- 当任务渠道包含“小蓝书”时，画布尺寸固定为 1242x1660px。必须直接把“1242x1660px”写入 dimensions，不得追问尺寸。
- 如果需求方另有明确尺寸要求，以需求方明确写出的尺寸为准。

视觉参考规则：
- visual_references 表示需求方上传的参考图，is_primary=true 为主参考。
- visual_reference_analysis 是千问视觉模型真正查看图片后得到的结构化视觉结论；它是视觉方向、构图、色彩、字体气质、材质与图形语言判断的首要依据。
- 必须把千问视觉结果转化为 visual_direction、layout_plan 与 recommendations 中可执行的设计语言。
- 参考图只是风格来源，不是内容来源。绝不能把参考图里的具体人物、猫、摩托车、地点、标题文案、品牌名、Logo自动加入新设计。
- 千问视觉结果中的 avoid_copying 必须遵守。
${visualAnalysisText}

内容作用域规则（最高优先级）：
- 如果某个来源出现 DESIGN_SCOPE_PRIORITY=EXPLICIT，说明来源作者已经明确标出了真正要做成设计稿/配图的内容。deliverables、pages、copy、layout_plan、success_criteria 必须只依据 DESIGN_SCOPE_BEGIN 与 DESIGN_SCOPE_END 之间的内容。
- 出现明确 DESIGN_SCOPE 时，全文其他正文、评论区、运营说明、联系人、URL、魔法指令、背景材料已经被系统隔离，不得通过旧追问、旧回答或历史聊天重新塞回设计页。
- 旧澄清只能解决设计作用域内部的歧义，不能扩大明确设计作用域。即使历史回答曾对作用域外内容回答“是”，也不能因此增加页面内容。
- 如果 DESIGN_SCOPE 已经按“第1页/第2页/第3页”列出内容，pages 必须与 DESIGN_SCOPE 中的页数一一对应，index 从1连续递增，title 使用该页标题，每页 copy 只能来自该页对应内容。
- 不得擅自合并、拆页、增加额外模块或把其他章节内容挪入这些页面。
- 逐页文案要保持原意和关键措辞。AI可以在 recommendations 中提出视觉建议，但 recommendations 绝不能伪装成来源要求。
- 不得把作用域之外的正文、评论区、联系人、链接、魔法指令自动塞进设计页。

规则：
1. 每条事实必须填写 source_id 和可以让人定位的 locator。
2. 推断、审美判断和方案建议必须放入 recommendations，label 固定为“AI建议”。
3. 缺少尺寸、完整文案、数量、关键素材、明确产出类型或截止时间时，写入 missing_information 并提出具体问题；但系统业务规格已经确定的字段不属于缺失信息，不得追问。
4. 来源互相矛盾时写入 conflicts，不得自行选择其中一个。
5. OpenTalk 必须先判断是“预告”还是“回顾”，只能推荐同类型模板。
6. copy 只保留实际需要出现在设计稿上的文字，不要把背景说明混进设计文案。
7. constraints 只能记录系统硬规则、需求单硬要求或需求方明确确认的限制；AI自己的排版/风格想法一律放 recommendations。
8. 如果明确设计作用域已经足够确定页面数量、页面标题和页面内容，不要再针对作用域外信息提出追问。
9. deliverables.quantity 必须与 pages.length 一致；如果 DESIGN_SCOPE 有3页，则必须输出3个 pages，不能只给一个总览。
10. 视觉建议必须与千问视觉分析一致；没有视觉分析时不得虚构参考图风格。

严格输出以下 JSON 对象结构，必须保留全部字段；没有内容的列表填写 []，未知截止日期填写空字符串：
${JSON.stringify({
  goal: "一句话说明设计目标",
  success_criteria: ["验收标准"],
  audience: ["目标受众"],
  deliverables: [{ type: "产出类型", quantity: 1 }],
  pages: [{ index: 1, title: "第1页标题", copy: ["该页必须呈现的原始文案"] }],
  channels: ["投放渠道"],
  dimensions: ["画布尺寸"],
  copy: ["跨页共同必须保留的文案；如无则[]"],
  visual_direction: ["由千问视觉分析转化出的可执行视觉方向"],
  layout_plan: ["逐页版式/信息层级规划"],
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
