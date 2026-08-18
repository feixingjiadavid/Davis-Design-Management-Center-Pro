export const DEMO_PROMPT_VERSION = "seedream-demo-creative-director-v2";

type Page = { index:number; title:string; copy:string[] };
type StyleReference = { file_name?:string; note?:string } | null;
type Asset = { file_name?:string; asset_role?:string; note?:string };

function strings(value:unknown){
  return Array.isArray(value) ? value.map(String).map(v=>v.trim()).filter(Boolean) : [];
}
function compactList(value:unknown, limit=6){ return strings(value).slice(0,limit).join("；"); }
function isCover(page:Page){ return /封面|主视觉|首图|开场/i.test(page.title); }
function relevantLayout(brief:Record<string,any>, page:Page){
  const plans=strings(brief.layout_plan);
  const hit=plans.find(line=>line.includes(`第${page.index}页`) || line.includes(page.title));
  return hit || plans[page.index-1] || plans[0] || "建立明确主视觉、标题层级、次级信息和安全留白";
}
function visualSummary(brief:Record<string,any>){
  const a=(brief.visual_reference_analysis && typeof brief.visual_reference_analysis==='object') ? brief.visual_reference_analysis : {};
  return [
    a.style_summary && `风格：${a.style_summary}`,
    compactList(a.composition_patterns) && `构图：${compactList(a.composition_patterns,4)}`,
    compactList(a.texture_materials) && `材质：${compactList(a.texture_materials,4)}`,
    compactList(a.hierarchy_rules) && `层级：${compactList(a.hierarchy_rules,4)}`,
    compactList(a.typography_style) && `字体：${compactList(a.typography_style,4)}`,
    compactList(a.color_palette) && `色彩：${compactList(a.color_palette,6)}`,
  ].filter(Boolean).join("\n");
}
function coverStrategy(page:Page){
  if(!isCover(page)) return "这是信息页：先确定一个视觉主轴，再围绕主轴组织规则、数据或模块；禁止平均分栏和模板式卡片堆叠。";
  return "这是封面页。封面不是正文信息页：第1条文案作为绝对主标题；其余必须呈现的信息明显降级为副标题、贴纸、标签或短提示，不能每条都做成同等重量的模块。先让人一眼看到主题和主视觉，再在第二眼读到核心卖点。";
}
function pageCopySections(page:Page){
  const all=page.copy.map(String).map(v=>v.trim()).filter(Boolean);
  const renderable=isCover(page) ? all.slice(0,6) : all;
  const context=isCover(page) ? all.slice(6) : [];
  const renderText=renderable.map((line,i)=>`${i+1}. ${line}`).join("\n");
  const contextText=context.map((line,i)=>`${i+1}. ${line}`).join("\n");
  return {renderText,contextText};
}

export function buildCreativeDemoPrompt(args:{brief:Record<string,any>;page:Page;styleReference:StyleReference;assets:Asset[]}){
  const {brief,page,styleReference,assets}=args;
  const copySections=pageCopySections(page);
  const assetText=assets.slice(0,9).map((a,i)=>`图${i+2}：${a.asset_role||a.file_name||'必用素材'}，保持身份特征与主要外观${a.note?`（${a.note}）`:''}`).join("\n");
  const contextBlock=copySections.contextText ? `\n\n【仅作理解上下文，不要在封面重复排版】\n这些信息会在后续页面展开。理解它们有助于建立主题，但不要把它们再塞进当前封面：\n${copySections.contextText}` : "";
  const prompt=`你是资深品牌视觉创意总监，不是排版工具。你的任务是直接完成一张具有成熟广告创意与视觉叙事的企业宣传设计 Demo。

【最重要：先做设计，再放素材】
先建立一个明确的视觉创意概念，再决定构图。画面必须像资深设计师完成的主视觉，而不是AI把IP、Logo、文字和几个色块摆上去。
- 必须形成一个统一的视觉隐喻/场景/叙事，例如“解锁、竞赛、收藏卡、荣誉舞台、实验室、任务界面”等与当前主题真正相关的概念；不要照抄这些例子，要根据项目自己选择。
- 至少三层空间关系：背景氛围层 / 中景信息与道具层 / 前景主角或强调元素层；允许遮挡、穿插、越界、透视和局部放大，让元素发生关系。
- IP必须与场景、道具、文字或图形发生关系：拿、指、踩、靠、穿插、互动、引导视线都可以；禁止把IP孤零零摆在底部。
- 字体必须参与构图：主标题可以有撕纸、描边、阴影、错位、透视、标签穿插，但仍要清楚可读。
- 用统一材质把画面连接起来，例如纸张、胶带、印章、颗粒、阴影、撕边、网点；禁止素材各自像贴上去的独立PNG。
- 禁止把版面切成三四条互不关联的横向色带；禁止纯色块分区 + 居中文字 + IP贴图的模板式方案。
- 禁止Word/PPT式排版、规整卡片墙、对称三栏、素材平铺、廉价贴纸堆砌。

【本页角色】
第${page.index}页《${page.title}》
${coverStrategy(page)}
版式要求：${relevantLayout(brief,page)}

【项目与风格】
项目目标：${String(brief.goal||page.title)}
视觉方向：${compactList(brief.visual_direction,5)||'现代、完整、有强视觉中心'}
${visualSummary(brief)}

【输入图片身份】
图1是风格参考：${styleReference?.file_name||'主参考图'}${styleReference?.note?`（${styleReference.note}）`:''}。只学习其设计成熟度、视觉密度、构图节奏、材质、色彩、字体与层次，不得复制参考图中的具体人物、品牌、标题或物体。
${assetText||'没有额外必用内容资产。'}
Logo只是品牌签名，不要放大成为主视觉；IP和主题内容才可以承担视觉角色。所有必用资产不得换身份、换Logo或重绘成另一角色。

【本页必须呈现的业务文案】
这些是当前页面允许出现并需要设计呈现的业务文字。保持文字含义和关键信息准确，但必须按主次设计，不能逐条等权摆放：
${copySections.renderText}${contextBlock}

【硬性限制】
${compactList(brief.constraints,8)||'四周保留安全边距，核心标题、IP、Logo和正文不得裁切'}

【最终自检】
生成前在内部检查：是否存在一个一眼能说清的创意概念？IP是否真的进入了设计而不是贴图？是否有前中后景和遮挡关系？标题是否是视觉的一部分？整页是否达到品牌活动主视觉完成度？如果只是色块+文字+IP，请推翻重做后再输出。

只输出这一页完整竖版设计，不输出草图、布局线框或说明文字。`;
  return prompt.slice(0,4500);
}
