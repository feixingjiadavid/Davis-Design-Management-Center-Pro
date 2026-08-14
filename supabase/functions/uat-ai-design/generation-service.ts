import { generateCloudflareDemo } from "./demo-client.ts";
import { generateSeedreamFinal } from "./seedream-client.ts";

export function assertCanGenerateDemo(analysisStatus: string) {
  if (analysisStatus !== "confirmed") throw new Error("UNDERSTANDING_CONFIRMATION_REQUIRED");
}

export function assertCanGenerateFinal(demoStatus: string, kind: string) {
  if (kind !== "demo") throw new Error("CONFIRMED_DEMO_REQUIRED");
  if (demoStatus !== "confirmed") throw new Error("DEMO_CONFIRMATION_REQUIRED");
}

export async function executeIdempotent<T>(existing: T | null, provider: () => Promise<T>) {
  return existing ?? await provider();
}

export function resolveDemoSize(brief: Record<string, unknown>) {
  const dimensions = Array.isArray(brief.dimensions) ? brief.dimensions.join(" ") : "";
  const explicit = dimensions.match(/(\d{3,5})\s*(?:px)?\s*[x×]\s*(\d{3,5})\s*(?:px)?/i);
  if (explicit) return { width: Number(explicit[1]), height: Number(explicit[2]) };
  const channels = Array.isArray(brief.channels) ? brief.channels.map(String) : [];
  if (channels.some((channel) => channel.includes("小蓝书"))) return { width: 1242, height: 1660 };
  throw new Error("DEMO_SIZE_REQUIRED");
}

export type DemoPage = { index: number; title: string; copy: string[] };
export type VisualReference = { id?: string; file_name: string; data_url: string; note?: string; is_primary?: boolean; sort_order?: number };
export type DesignAsset = { id?: string; file_name: string; data_url: string; asset_role?: string; note?: string; sort_order?: number };

type ModelInput = (VisualReference | DesignAsset) & { input_kind: "style" | "asset" };

export function selectGenerationPages(brief: Record<string, unknown>): DemoPage[] {
  const rawPages = Array.isArray(brief.pages) ? brief.pages : [];
  const pages = rawPages.map((page: any, offset) => ({
    index: Number(page?.index || offset + 1),
    title: String(page?.title || `第${offset + 1}页`),
    copy: Array.isArray(page?.copy) ? page.copy.map(String).filter(Boolean) : [],
  })).sort((a, b) => a.index - b.index);
  if (!pages.length) {
    const fallbackCopy = Array.isArray(brief.copy) ? brief.copy.map(String).filter(Boolean) : [];
    if (!fallbackCopy.length) throw new Error("DEMO_PAGE_CONTENT_REQUIRED");
    return [{ index: 1, title: String(brief.goal || "设计页"), copy: fallbackCopy }];
  }
  const expected = Array.isArray(brief.deliverables)
    ? brief.deliverables.reduce((max: number, item: any) => Math.max(max, Number(item?.quantity || 0)), 0)
    : 0;
  if (expected > 0 && pages.length !== expected) throw new Error("DEMO_PAGE_COUNT_MISMATCH");
  pages.forEach((page, offset) => {
    if (page.index !== offset + 1 || !page.title.trim() || !page.copy.length) throw new Error("DEMO_PAGE_STRUCTURE_INVALID");
  });
  return pages;
}

export function selectModelReferences<T extends { is_primary?: boolean; sort_order?: number }>(references: T[]): T[] {
  return [...references]
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .slice(0, 4);
}

export function selectModelInputs<T extends { is_primary?: boolean; sort_order?: number }, A extends { sort_order?: number }>(styleReferences: T[], assets: A[]): Array<(T | A) & { input_kind: "style" | "asset" }> {
  const style = selectModelReferences(styleReferences).slice(0, 1).map((item) => ({ ...item, input_kind: "style" as const }));
  const required = [...assets]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .slice(0, Math.max(0, 4 - style.length))
    .map((item) => ({ ...item, input_kind: "asset" as const }));
  return [...style, ...required];
}

function compactVisualAnalysis(brief: Record<string, unknown>) {
  const value = brief.visual_reference_analysis;
  if (!value || typeof value !== "object") return "无千问视觉分析";
  const a = value as Record<string, any>;
  return [
    `整体风格：${String(a.style_summary || "")}`,
    `风格关键词：${Array.isArray(a.style_keywords) ? a.style_keywords.join("、") : ""}`,
    `构图规律：${Array.isArray(a.composition_patterns) ? a.composition_patterns.join("；") : ""}`,
    `字体气质：${Array.isArray(a.typography_style) ? a.typography_style.join("；") : ""}`,
    `色彩：${Array.isArray(a.color_palette) ? a.color_palette.join("、") : ""}`,
    `图片处理：${Array.isArray(a.image_treatment) ? a.image_treatment.join("；") : ""}`,
    `材质纹理：${Array.isArray(a.texture_materials) ? a.texture_materials.join("；") : ""}`,
    `图形元素：${Array.isArray(a.graphic_elements) ? a.graphic_elements.join("；") : ""}`,
    `层级：${Array.isArray(a.hierarchy_rules) ? a.hierarchy_rules.join("；") : ""}`,
    `主参考重点：${String(a.primary_reference_focus || "")}`,
    `禁止照搬：${Array.isArray(a.avoid_copying) ? a.avoid_copying.join("；") : ""}`,
  ].filter((line) => !line.endsWith("：")).join("\n");
}

export function demoPagePrompt(brief: Record<string, unknown>, page: DemoPage, styleReferences: VisualReference[], assets: DesignAsset[] = []) {
  const visualDirection = Array.isArray(brief.visual_direction) ? brief.visual_direction : [];
  const layoutPlan = Array.isArray(brief.layout_plan) ? brief.layout_plan : [];
  const constraints = Array.isArray(brief.constraints) ? brief.constraints : [];
  const recommendations = Array.isArray(brief.recommendations) ? brief.recommendations.map((item: any) => item?.value).filter(Boolean) : [];
  const styleNotes = styleReferences.map((reference, index) => `${index === 0 ? "主风格参考" : `风格参考${index + 1}`}：${reference.file_name}${reference.note ? `（${reference.note}）` : ""}`);
  const assetNotes = assets.map((asset, index) => `必用素材${index + 1}：${asset.asset_role || "设计元素"} / ${asset.file_name}${asset.note ? `（${asset.note}）` : ""}`);

  return `你是专业企业视觉设计师。现在只生成第 ${page.index} 页的“无文字视觉底图”，用于确认构图、视觉语言、主视觉与空间层次。中文文字和必用品牌素材会由系统后置精确叠加，因此你不能自己重写文字，也不能把风格参考里的内容照搬过来。

【本页】${page.title}
【本页内容语义，仅用于帮助你理解主题；禁止把这些字画进图片】
${page.copy.map((line) => `- ${line}`).join("\n")}

【千问视觉对风格参考的真实分析】
${compactVisualAnalysis(brief)}

【DeepSeek整理后的视觉方向】${visualDirection.join("；") || "以风格参考为主"}
【本页版式规划】${layoutPlan.join("；") || "由专业设计判断"}
【硬性限制】${constraints.join("；") || "无"}
【AI设计建议】${recommendations.join("；") || "无"}
【风格参考：只学设计语言】
${styleNotes.join("\n") || "无"}
【必用素材：只用于理解预留空间，素材本体会后置精确叠加】
${assetNotes.join("\n") || "无"}

要求：
1. input image 0（若存在）只是主风格参考，只学习配色、构图、材质、拼贴节奏、图形语言和视觉密度。严禁照搬里面的具体人物、猫、摩托车、地点、标题、Logo或品牌内容。
2. 后续 input images（若存在）是必用素材，例如公司IP、Logo、人物或主视觉。系统会在生成后精确叠加这些原始素材。你只需为它们预留合理位置和空间，不要自行重画、改造、复制或生成第二份。
3. 禁止生成任何可读文字、汉字、字母、数字、伪文字、Logo字样、水印或标牌文字。所有正式文字由系统后置排版层完成。
4. 必须像真正的小蓝书宣传视觉：有明确主视觉、有图形/插画/拼贴/空间层次、有视觉中心；禁止生成Word/PPT式纯码字页面。
5. 上部约35%区域预留给标题与关键信息，保持视觉干净；中下部用于主视觉和图形元素。若有必用IP/人物素材，为右下或下部预留完整、安全、不拥挤的位置。
6. 不得添加其他页面、正文区、评论区、联系人、链接、魔法指令等不属于本页的内容。
7. 单页完整竖版构图，四周保留安全边距，核心元素不得裁切。`;
}

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch] || ch));
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

function wrapText(value: string, maxChars: number) {
  const chars = Array.from(String(value || "").trim());
  if (!chars.length) return [];
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += maxChars) lines.push(chars.slice(index, index + maxChars).join(""));
  return lines;
}

function isCollageStyle(brief: Record<string, unknown>) {
  const analysis = brief.visual_reference_analysis as any;
  const words = [analysis?.style_summary, ...(Array.isArray(analysis?.style_keywords) ? analysis.style_keywords : [])].map(String).join(" ");
  return /拼贴|复古|杂志|贴纸|街头|潮流/.test(words);
}

function assetSvg(asset: DesignAsset, index: number, width: number, height: number) {
  const role = String(asset.asset_role || "");
  const isLogo = /logo|标识|品牌标/i.test(role);
  const boxW = isLogo ? Math.round(width * 0.22) : Math.round(width * 0.31);
  const boxH = isLogo ? Math.round(height * 0.10) : Math.round(height * 0.30);
  const positions = [
    { x: width - boxW - 58, y: isLogo ? 58 : height - boxH - 70 },
    { x: 58, y: height - boxH - 70 },
    { x: Math.round((width - boxW) / 2), y: height - boxH - 64 },
    { x: width - boxW - 58, y: Math.round(height * 0.54) },
    { x: 58, y: Math.round(height * 0.54) },
    { x: Math.round((width - boxW) / 2), y: Math.round(height * 0.50) },
  ];
  const pos = positions[index] || positions[positions.length - 1];
  return `<g><image href="${escapeXml(asset.data_url)}" x="${pos.x}" y="${pos.y}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid meet"/><text x="${pos.x}" y="${Math.max(24, pos.y - 10)}" font-size="16" fill="rgba(255,255,255,.68)" font-family="Microsoft YaHei,PingFang SC,sans-serif">${escapeXml(role)}</text></g>`;
}

export function composeDeterministicDemo(
  background: Record<string, any>,
  size: { width: number; height: number },
  page: DemoPage,
  assets: DesignAsset[] = [],
  brief: Record<string, unknown> = {},
) {
  const backgroundUrl = String(background?.image_url || "");
  if (!backgroundUrl) return { ...background, text_rendering: "provider_only", asset_count: assets.length };

  const collage = isCollageStyle(brief);
  const copy = page.copy.map(String).filter(Boolean);
  const titleSource = copy[0] || page.title;
  const subtitleSource = copy[1] || "";
  const bodySource = copy.slice(2);
  const titleLines = wrapText(titleSource, 14).slice(0, 3);
  const subtitleLines = wrapText(subtitleSource, 22).slice(0, 3);
  const bodyLines = bodySource.flatMap((line) => wrapText(line, assets.length ? 25 : 34));
  const bodyFont = Math.max(19, Math.min(29, Math.floor(470 / Math.max(1, bodyLines.length) * 0.88)));
  const bodyLineHeight = Math.round(bodyFont * 1.48);
  const bodyWidth = assets.length ? Math.round(size.width * 0.58) : size.width - 140;
  const bodyX = 70;
  const bodyY = Math.round(size.height * 0.62);
  const bodyH = Math.max(180, Math.min(560, bodyLines.length * bodyLineHeight + 70));

  const titleFill = collage ? "#fff8df" : "#ffffff";
  const titleStroke = collage ? "#101114" : "rgba(0,0,0,.35)";
  const titleShadow = collage ? "#ff3e8a" : "rgba(0,0,0,.45)";
  const titleSvg = titleLines.map((line, index) => {
    const y = 125 + index * 78;
    return `<text x="72" y="${y}" font-size="62" font-weight="900" fill="${titleFill}" stroke="${titleStroke}" stroke-width="${collage ? 8 : 2}" paint-order="stroke fill" font-family="Microsoft YaHei,PingFang SC,sans-serif"><tspan x="78" y="${y + 7}" fill="${titleShadow}" stroke="none">${escapeXml(line)}</tspan><tspan x="72" y="${y}">${escapeXml(line)}</tspan></text>`;
  }).join("");
  const subtitleStart = 145 + titleLines.length * 78;
  const subtitleSvg = subtitleLines.map((line, index) => `<text x="76" y="${subtitleStart + index * 46}" font-size="34" font-weight="800" fill="#ffffff" font-family="Microsoft YaHei,PingFang SC,sans-serif">${escapeXml(line)}</text>`).join("");
  const bodySvg = bodyLines.map((line, index) => `<text x="${bodyX + 28}" y="${bodyY + 48 + index * bodyLineHeight}" font-size="${bodyFont}" font-weight="${index < 2 ? 700 : 500}" fill="#151515" font-family="Microsoft YaHei,PingFang SC,sans-serif">${escapeXml(line)}</text>`).join("");
  const assetsSvg = assets.slice(0, 6).map((asset, index) => assetSvg(asset, index, size.width, size.height)).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.58)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient>
      <filter id="paperShadow"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-opacity=".24"/></filter>
    </defs>
    <image href="${escapeXml(backgroundUrl)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${size.width}" height="${Math.round(size.height * 0.43)}" fill="url(#topShade)"/>
    ${collage ? `<rect x="58" y="${Math.max(82, subtitleStart - 18)}" width="${Math.min(size.width - 116, 520)}" height="18" fill="#ffd84d" transform="rotate(-1 58 ${subtitleStart})"/>` : ""}
    ${titleSvg}
    ${subtitleSvg}
    ${bodyLines.length ? `<rect x="${bodyX}" y="${bodyY}" rx="22" width="${bodyWidth}" height="${bodyH}" fill="rgba(255,250,239,.94)" filter="url(#paperShadow)"/>${bodySvg}` : ""}
    ${assetsSvg}
  </svg>`;

  return {
    ...background,
    background_image_url: backgroundUrl,
    image_url: `data:image/svg+xml;base64,${encodeBase64Utf8(svg)}`,
    size,
    text_rendering: "deterministic_svg",
    exact_copy: copy,
    asset_count: assets.length,
  };
}

function finalPrompt(brief: Record<string, unknown>, demoOutput: Record<string, unknown>) {
  return `根据已确认的需求理解单和已确认 Demo 生成正式成品。保持 Demo 的构图与信息层级，不删减文案。正式成品中的中文文案必须与 exact_copy 完全一致，必用素材必须使用 design_assets 中的原始资产，不得重新想象品牌IP或Logo。\n需求理解：${JSON.stringify(brief)}\n确认 Demo：${JSON.stringify(demoOutput)}`;
}

async function findIdempotent(admin: any, key: string) {
  return (await admin.from("uat_design_generations").select("*").eq("idempotency_key", key).maybeSingle()).data;
}

async function findActiveDemo(admin: any, taskId: string, analysisId: string, pageIndex: number) {
  return (await admin.from("uat_design_generations")
    .select("*")
    .eq("task_id", taskId)
    .eq("analysis_id", analysisId)
    .eq("kind", "demo")
    .eq("page_index", pageIndex)
    .in("status", ["generating", "ready", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()).data;
}

async function loadVisualReferences(admin: any, taskId: string) {
  const result = await admin.from("uat_visual_references")
    .select("id,file_name,data_url,note,is_primary,sort_order")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function loadDesignAssets(admin: any, taskId: string) {
  const result = await admin.from("uat_design_assets")
    .select("id,file_name,data_url,asset_role,note,sort_order")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function generateDemoPage(admin: any, taskId: string, analysis: any, page: DemoPage, pageCount: number, references: VisualReference[], assets: DesignAsset[]) {
  const existing = await findActiveDemo(admin, taskId, analysis.id, page.index);
  if (existing) return existing;
  const idempotencyKey = crypto.randomUUID();
  const model = Deno.env.get("CLOUDFLARE_DEMO_MODEL") || "unconfigured";
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysis.id,
    kind: "demo",
    model,
    prompt_version: "demo-style-assets-exact-text-v3",
    idempotency_key: idempotencyKey,
    page_index: page.index,
    page_count: pageCount,
    status: "generating",
  }).select("*").single();
  if (queued.error) throw queued.error;
  try {
    const size = resolveDemoSize(analysis.brief);
    const modelInputs = selectModelInputs(references, assets);
    const providerInputs = modelInputs.map((item: any) => ({ file_name: item.file_name, data_url: item.data_url }));
    const background = await generateCloudflareDemo(demoPagePrompt(analysis.brief, page, references, assets), size, providerInputs);
    const output = composeDeterministicDemo(background, size, page, assets, analysis.brief);
    const updated = await admin.from("uat_design_generations").update({
      status: "ready",
      output: { ...output, page_index: page.index, page_count: pageCount, page_title: page.title, style_reference_count: references.length, design_asset_count: assets.length },
      updated_at: new Date().toISOString(),
    }).eq("id", queued.data.id).select("*").single();
    if (updated.error) throw updated.error;
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo generation failed";
    await admin.from("uat_design_generations").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", queued.data.id);
    throw error;
  }
}

export async function generateDemoSet(admin: any, taskId: string, analysisId: string) {
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", analysisId).eq("task_id", taskId).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  assertCanGenerateDemo(analysis.status);
  const task = (await admin.from("test_tasks").select("request_type").eq("id", taskId).single()).data;
  const [references, assets] = await Promise.all([loadVisualReferences(admin, taskId), loadDesignAssets(admin, taskId)]);
  if ((task?.request_type === "平面视觉" || !task?.request_type) && references.length === 0) throw new Error("VISUAL_REFERENCE_REQUIRED");
  if (references.length > 0 && !analysis.brief?.visual_reference_analysis) throw new Error("QWEN_VISUAL_ANALYSIS_REQUIRED");
  const pages = selectGenerationPages(analysis.brief);
  return await Promise.all(pages.map((page) => generateDemoPage(admin, taskId, analysis, page, pages.length, references, assets)));
}

export async function generateDemo(admin: any, taskId: string, analysisId: string, idempotencyKey: string) {
  const existing = idempotencyKey ? await findIdempotent(admin, idempotencyKey) : null;
  if (existing) return existing;
  const set = await generateDemoSet(admin, taskId, analysisId);
  return set[0];
}

export async function confirmDemo(admin: any, taskId: string, generationId: string, userId: string) {
  const demo = (await admin.from("uat_design_generations").select("*").eq("id", generationId).eq("task_id", taskId).eq("kind", "demo").single()).data;
  if (!demo || demo.status !== "ready") throw new Error("READY_DEMO_REQUIRED");
  const updated = await admin.from("uat_design_generations").update({ status: "confirmed", confirmed_by: userId, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", generationId).select("*").single();
  if (updated.error) throw updated.error;
  return updated.data;
}

export async function generateFinal(admin: any, taskId: string, demoGenerationId: string, idempotencyKey: string) {
  const existing = await findIdempotent(admin, idempotencyKey);
  if (existing) return existing;
  const demo = (await admin.from("uat_design_generations").select("*").eq("id", demoGenerationId).eq("task_id", taskId).single()).data;
  if (!demo) throw new Error("DEMO_NOT_FOUND");
  assertCanGenerateFinal(demo.status, demo.kind);
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", demo.analysis_id).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  const model = Deno.env.get("SEEDREAM_MODEL") || "unconfigured";
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysis.id,
    parent_generation_id: demo.id,
    kind: "final",
    model,
    prompt_version: "seedream-final-v2-exact-copy-assets",
    idempotency_key: idempotencyKey,
    page_index: demo.page_index,
    page_count: demo.page_count,
    status: "generating",
  }).select("*").single();
  if (queued.error) {
    const raced = await findIdempotent(admin, idempotencyKey);
    if (raced) return raced;
    throw queued.error;
  }
  try {
    const output = await generateSeedreamFinal(finalPrompt(analysis.brief, demo.output));
    const updated = await admin.from("uat_design_generations").update({ status: "ready", output, updated_at: new Date().toISOString() }).eq("id", queued.data.id).select("*").single();
    if (updated.error) throw updated.error;
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final generation failed";
    await admin.from("uat_design_generations").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", queued.data.id);
    throw error;
  }
}
