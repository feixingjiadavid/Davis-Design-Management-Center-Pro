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

export function demoPagePrompt(brief: Record<string, unknown>, page: DemoPage, references: VisualReference[]) {
  const visualDirection = Array.isArray(brief.visual_direction) ? brief.visual_direction : [];
  const layoutPlan = Array.isArray(brief.layout_plan) ? brief.layout_plan : [];
  const constraints = Array.isArray(brief.constraints) ? brief.constraints : [];
  const recommendations = Array.isArray(brief.recommendations) ? brief.recommendations.map((item: any) => item?.value).filter(Boolean) : [];
  const referenceNotes = references.map((reference, index) => `${index === 0 ? "主参考" : `参考${index + 1}`}：${reference.file_name}${reference.note ? `（${reference.note}）` : ""}`);

  return `你是专业企业视觉设计师。生成第 ${page.index} 页低成本视觉 Demo，用于确认构图、视觉语言、信息层级和风格方向。绝不是文档截图，也不是纯文字白底排版。

【本页】${page.title}
【本页唯一内容来源】
${page.copy.map((line) => `- ${line}`).join("\n")}

【千问视觉对参考图的真实分析】
${compactVisualAnalysis(brief)}

【DeepSeek整理后的视觉方向】${visualDirection.join("；") || "以参考图为主"}
【本页版式规划】${layoutPlan.join("；") || "由专业设计判断"}
【硬性限制】${constraints.join("；") || "无"}
【AI设计建议】${recommendations.join("；") || "无"}
【传给模型的视觉参考】
${referenceNotes.join("\n")}

要求：
1. input image 0 为主参考，强继承它的视觉语言；其他 input images 用于提炼共同风格。千问视觉分析是对这些图片的真实观察，必须落实到构图、色彩、字体气质、拼贴/材质/图形处理上。
2. 只继承“设计语言”，严禁照搬参考图里的具体人物、猫、摩托车、地点、Logo、标题文案或品牌内容。
3. 必须像真正的小蓝书宣传视觉：有主视觉、有图形/插画/拼贴/空间层次、有明确视觉中心；禁止生成Word/PPT式纯码字页面。
4. 文字只做信息层级：突出主标题、关键数字、短句；不要把全部文案排成文章。长文案只作为语义依据。
5. 不得添加其他页面、正文区、评论区、联系人、链接、魔法指令等不属于本页 copy 的内容。
6. 单页完整竖版构图，四周保留安全边距，核心元素不得裁切。`;
}

function finalPrompt(brief: Record<string, unknown>, demoOutput: Record<string, unknown>) {
  return `根据已确认的需求理解单和已确认 Demo 生成正式成品。保持 Demo 的构图与信息层级，不删减文案。\n需求理解：${JSON.stringify(brief)}\n确认 Demo：${JSON.stringify(demoOutput)}`;
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

async function generateDemoPage(admin: any, taskId: string, analysis: any, page: DemoPage, pageCount: number, references: VisualReference[]) {
  const existing = await findActiveDemo(admin, taskId, analysis.id, page.index);
  if (existing) return existing;
  const idempotencyKey = crypto.randomUUID();
  const model = Deno.env.get("CLOUDFLARE_DEMO_MODEL") || "unconfigured";
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysis.id,
    kind: "demo",
    model,
    prompt_version: "demo-reference-page-v2-qwen",
    idempotency_key: idempotencyKey,
    page_index: page.index,
    page_count: pageCount,
    status: "generating",
  }).select("*").single();
  if (queued.error) throw queued.error;
  try {
    const size = resolveDemoSize(analysis.brief);
    const modelReferences = selectModelReferences(references);
    const output = await generateCloudflareDemo(demoPagePrompt(analysis.brief, page, modelReferences), size, modelReferences);
    const updated = await admin.from("uat_design_generations").update({
      status: "ready",
      output: { ...output, page_index: page.index, page_count: pageCount, page_title: page.title },
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
  const references = await loadVisualReferences(admin, taskId);
  if ((task?.request_type === "平面视觉" || !task?.request_type) && references.length === 0) throw new Error("VISUAL_REFERENCE_REQUIRED");
  if (references.length > 0 && !analysis.brief?.visual_reference_analysis) throw new Error("QWEN_VISUAL_ANALYSIS_REQUIRED");
  const pages = selectGenerationPages(analysis.brief);
  return await Promise.all(pages.map((page) => generateDemoPage(admin, taskId, analysis, page, pages.length, references)));
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
    prompt_version: "seedream-final-v1",
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
