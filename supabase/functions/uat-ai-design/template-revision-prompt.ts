export const TEMPLATE_REVISION_PROMPT_VERSION = 'seedream-template-revision-v1';

function lines(value: any) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export function buildTemplateRevisionPrompt(input: {
  pageIndex: number;
  pageTitle: string;
  newCopy: string[];
  changeSummary?: any;
  assets?: any[];
}) {
  const copy = lines(input.newCopy).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const changes = typeof input.changeSummary === 'string' ? input.changeSummary : JSON.stringify(input.changeSummary || {});
  const assets = (input.assets || []).map((asset: any, index: number) =>
    `素材${index + 1}: ${String(asset.asset_role || asset.file_name || '必用素材')}${asset.note ? `（${asset.note}）` : ''}`
  ).join('\n');
  return `你正在执行企业设计稿的“内容改版”，不是重新设计。\n\n【不可变视觉母版】\n输入图1是领导已经批准的第 ${input.pageIndex} 页《${input.pageTitle}》高清母版，是本轮最高优先级视觉约束。必须保持其整体构图体系、背景体系、主色体系、字体气质、装饰语言、IP/Logo规则、页面职责、信息层级与视觉节奏。禁止重新设计、禁止换风格、禁止重新建立视觉概念。\n\n【本轮唯一业务目标】\n只把下列新内容准确替换/调整进母版。为了容纳新文字，只允许做必要的字号、行距、局部间距和局部元素位置微调；不得借机重排整页。\n${copy}\n\n【内容差异】\n${changes}\n\n【必用原始资产】\n${assets || '无新增必用资产；继续保持母版中的既有品牌/IP身份。'}\n\n【硬性要求】\n1. 输入图1必须作为视觉锚点，不得被其他风格参考覆盖。\n2. 中文文案以“本轮唯一业务目标”为准，不新增业务文案。\n3. Logo、IP、人物、品牌资产保持原身份，不重绘成另一对象。\n4. 输出仍是一张完整可评审页面，四周安全边距完整，不裁切。\n5. 如果新内容无法在当前母版内合理承载，不要擅自换框架；系统应在生成前拦截容量冲突。`;
}
