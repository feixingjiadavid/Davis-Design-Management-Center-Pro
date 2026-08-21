import { pageCreativeStrategy, pageInformationArchitecture } from './creative-strategy.mjs';

export const DEMO_PROMPT_VERSION = "seedream-brand-safe-creative-v3";
export const DEMO_PROMPT_BUILD = "brand-safe-area-20260821-v1";

type Page = { index:number; title:string; copy:string[] };
type StyleReference = { file_name?:string; note?:string } | null;
type Asset = { file_name?:string; asset_role?:string; note?:string };
type BrandPlan = { creativeArea?:{x:number;y:number;width:number;height:number};safeArea?:{top_left_reserved?:boolean;bottom_reserved?:boolean};pageRule?:{apply_brand?:boolean;forbidden_asset_types?:string[]} } | null;
function strings(value:unknown){return Array.isArray(value)?value.map(String).map(v=>v.trim()).filter(Boolean):[];}
function compactList(value:unknown,limit=6){return strings(value).slice(0,limit).join("；");}
function isCover(page:Page){return /封面|主视觉|首图|开场/i.test(page.title);}
function relevantLayout(brief:Record<string,any>,page:Page){const plans=strings(brief.layout_plan);return plans.find(line=>line.includes(`第${page.index}页`)||line.includes(page.title))||plans[page.index-1]||plans[0]||"建立明确主视觉、标题层级、次级信息和安全留白";}
function visualSummary(brief:Record<string,any>){const a=(brief.visual_reference_analysis&&typeof brief.visual_reference_analysis==='object')?brief.visual_reference_analysis:{};return [a.style_summary&&`风格：${a.style_summary}`,compactList(a.composition_patterns,4)&&`构图：${compactList(a.composition_patterns,4)}`,compactList(a.texture_materials,4)&&`材质：${compactList(a.texture_materials,4)}`,compactList(a.hierarchy_rules,4)&&`层级：${compactList(a.hierarchy_rules,4)}`,compactList(a.typography_style,4)&&`字体：${compactList(a.typography_style,4)}`,compactList(a.color_palette,6)&&`色彩：${compactList(a.color_palette,6)}`].filter(Boolean).join("\n");}
function formatIA(page:Page){const groups=pageInformationArchitecture(page) as Record<string,string[]>;const labels:Record<string,string>={hero:'主信息',support:'辅助信息',context:'后续上下文（当前页弱化）',reward:'奖励层级',meta:'统计信息',steps:'参与路径',note:'收尾提示',trackA:'赛道A',trackB:'赛道B'};return Object.entries(groups).filter(([,v])=>v?.length).map(([k,v])=>`【${labels[k]||k}】\n${v.map((x,i)=>`${i+1}. ${x}`).join("\n")}`).join("\n\n");}
function roleInstruction(page:Page){if(isCover(page))return "这是封面主视觉。第一眼必须看到主题，第二眼看到核心利益点。不要把所有正文做成同等重量。";if(/规则|TOP|排名|SKILL/i.test(page.title))return "这是规则页，但仍然必须像广告主视觉而不是规则表。奖励层级、参与步骤和统计信息要成为同一场景中的道具、路径和视觉节点。";if(/赛道|分享|文化|两条/i.test(page.title))return "这是双赛道页。两条赛道必须从同一视觉中心自然分叉，保持统一空间、材质和主角关系，不能做成左右两个独立卡片。";return "这是信息页：先建立一个视觉主轴，再围绕主轴组织信息。";}
function logoLike(asset:Asset){const value=`${asset.asset_role||''} ${asset.file_name||''}`.toLowerCase();return /logo|标志|标识|wesmart|科技及智能事业群/.test(value);}
function brandAreaInstruction(brandPlan:BrandPlan){
  const area=brandPlan?.creativeArea;
  const safe=brandPlan?.safeArea||{};
  if(safe.top_left_reserved||safe.bottom_reserved){return `【系统品牌区域：模型严禁占用】
- 你只负责 Creative Area${area?`（x=${area.x}, y=${area.y}, ${area.width}×${area.height}）`:''}，不要生成完整品牌画布。
- Logo和底部组织标识由系统 Image Composer 在生成后添加；禁止绘制、临摹、拼写或修改任何Logo。
- leave clean space at top left for brand logo
- leave clean space at bottom for organization logo
- 左上角不得放文字、人物主体或关键视觉；底部不得放关键文案或关键视觉元素。`;}
  return `【系统品牌规则】
- 当前页禁止出现任何Logo、品牌签名或组织标识；不要绘制、临摹、拼写或修改Logo。
- Logo不属于模型输入，也不属于 Creative Area。`;
}

export function buildCreativeDemoPrompt(args:{brief:Record<string,any>;page:Page;styleReference:StyleReference;assets:Asset[];brandPlan?:BrandPlan}){
  const {brief,page,styleReference,assets,brandPlan=null}=args;
  const creativeAssets=assets.filter(a=>!logoLike(a));
  const assetText=creativeAssets.slice(0,9).map((a,i)=>`图${i+2}：${a.asset_role||a.file_name||'必用素材'}；${a.note||'保持原始身份与外观'}`).join("\n");
  const prompt=`你是资深品牌视觉创意总监和广告美术指导。直接完成一张可进入设计评审的企业活动视觉 Demo，不是排版草稿，不是PPT，不是把素材摆进模板。

【最高优先级：先形成一个完整创意场景】
本页创意策略：${pageCreativeStrategy(page)}
${roleInstruction(page)}
- 先确定一个能用一句话说清的视觉隐喻，再安排文字和素材。
- 至少有背景氛围层 / 中景信息与道具层 / 前景主角层；使用遮挡、穿插、越界、透视、局部放大制造空间关系。
- 所有元素必须属于同一个场景：标题、IP、奖杯、榜单、路径、标签、纸张、胶带、印章、颗粒等要互相发生关系，不能像独立PNG贴上去。
- 禁止三条横向色带、三个独立奖励色块、规整卡片墙、左右两个孤立信息框、平均分栏、Word/PPT式排版。
- 旧版式规划只作为“信息必须完整”的参考，不能照搬其色块/分栏结构：${relevantLayout(brief,page)}

【视觉完成度标准】
画面要像成熟品牌活动海报：一个强主视觉中心 + 清楚的第二视觉中心 + 有节奏的辅助信息；高密度但不拥堵；大标题真正参与构图，而不是顶部放一行字。
参考图只学习设计成熟度、拼贴密度、撕纸材质、高饱和对比、字体与图形融合、前后景关系。不要复制参考图的具体人物、猫、摩托车、地名、Logo或原文案。
${visualSummary(brief)}

【本页】
第${page.index}页《${page.title}》
项目目标：${String(brief.goal||page.title)}
视觉方向：${compactList(brief.visual_direction,5)||'现代、完整、有强视觉中心'}

${brandAreaInstruction(brandPlan)}

【信息架构：内容完整，但必须设计出主次】
${formatIA(page)}
所有金额、TOP区间、平台名、统计周期和关键动作必须准确；长句可以通过字号、换行和层级组织，不得擅自改业务含义。

【输入图片身份与品牌资产】
图1是风格参考：${styleReference?.file_name||'主参考图'}${styleReference?.note?`（${styleReference.note}）`:''}。
${assetText||'没有额外必用内容资产。'}
- TIG IP虎是已提供的品牌角色资产：优先把它当作原始抠图素材嵌入场景，只允许位置、尺度、遮挡和姿态关系上的编排；不要重新设计脸、身体比例、额头TIG、配色或Logo。若无法精确保留，宁可减少对其形体的再创作，也不要生成另一只虎。
- IP必须参与场景：指向榜单、站上领奖台、沿任务路径行动、与标题或道具穿插均可；禁止孤零零站在页面底部。

【材质与排版】
统一使用复古拼贴的纸张、撕边、网点、颗粒、胶带、印章、阴影等材质连接全页。字体要有设计感但清楚可读；标题可以描边、错位、透视、纸片叠压，正文保持阅读效率。四周留安全边距，不裁切核心标题、金额或IP。

【硬性限制】
${compactList(brief.constraints,8)||'尺寸与品牌元素必须准确'}

【输出前内部自检】
如果画面仍然可以概括为“色块 + 文案 + IP”，说明设计没有完成，必须推翻并重新组织成连续场景；只有达到品牌活动主视觉的叙事、层次和材质统一后再输出。再次确认：输出中不得包含任何AI生成Logo。

只输出当前这一页 Creative Area 设计，不输出Logo、线框、解释、草稿或设计说明。`;
  return prompt.slice(0,4800);
}
