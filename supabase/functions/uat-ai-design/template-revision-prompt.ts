export const TEMPLATE_REVISION_PROMPT_VERSION = 'seedream-template-revision-v1';

function lines(value: any) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function changeText(value: any) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const feedback = String(value.requester_feedback || '').trim();
  const resolved = value.clarification_resolution && typeof value.clarification_resolution === 'object'
    ? Object.entries(value.clarification_resolution).map(([key, item]) => `${key}: ${String(item)}`).join('；')
    : '';
  const raw = JSON.stringify(value);
  return [feedback, resolved, raw].filter(Boolean).join('\n');
}

export function buildTemplateRevisionPrompt(input: {
  pageIndex: number;
  pageTitle: string;
  newCopy: string[];
  changeSummary?: any;
  assets?: any[];
}) {
  const copy = lines(input.newCopy).map((item, index) => `${index + 1}. ${item}`).join('\n');
  const changes = changeText(input.changeSummary);
  return `你正在执行企业设计稿的“局部内容修改”，不是重新设计，也不是重新生成一张相似海报。\n\n【唯一视觉底图】\n输入图1是领导已经批准并锁定的第 ${input.pageIndex} 页《${input.pageTitle}》高清母版，也是本轮唯一允许参考的图像。请把它当作需要局部修改的原图，而不是风格参考。\n\n【像素级保护原则】\n除需求方明确指定需要修改的文字区域外，其余区域全部视为锁定区域：构图、背景、颜色、纹理、撕纸边缘、装饰、照片、IP、Logo、字号层级、元素位置和比例都必须保持原样。禁止为了“更好看”而重新排版或重绘。\nLogo 与 IP 尤其禁止重绘、禁止改色、禁止变形、禁止改字形、禁止移动、禁止替换；必须保持输入母版中的原始外观。\n\n【本页必须准确保留的正文】\n以下正文必须逐字准确，不得出现乱码、伪中文、错别字、随机符号或模型自造文字：\n${copy || '本页无正文替换要求；继续保持母版现有正文。'}\n\n【本轮最终执行指令｜最高优先级】\n${changes || '仅按已确认正文做最小必要纠错，其他不变。'}\n\n【局部修改规则】\n1. 只修改明确指定的文字实例和明确指定的位置。若同一个词语在页面其他位置也出现，其他位置的相同文字必须保持原样。\n2. 如果指令带有方位描述（例如“虎IP右边”“旗帜下方”“标题下面”），只修改该方位对应的那个实例，禁止全局替换。\n3. 如果“本页必须准确保留的正文”里仍包含某个词语，说明该正文实例必须保留；不能因为另一个局部标签要改而把正文中的同词一起改掉。\n4. 对于文字乱码纠错，按上方逐字正文重新校正文字，但不要重做背景、Logo、IP、插画或版式。任何不确定字符都不得编造；宁可保持母版现有字形，也不能生成伪中文。\n5. 禁止新增任何未在正文或最终执行指令中出现的业务文案。\n6. 输出必须仍是一张完整可评审页面，尺寸、四周安全边距和母版一致，不裁切。\n\n【执行优先级】\n最终执行指令 > 本页逐字正文 > 输入母版现有内容。除冲突处外，输入母版中的一切保持不变。`;
}
