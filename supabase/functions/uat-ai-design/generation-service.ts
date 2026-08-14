import { generateSeedreamDemo, generateSeedreamFinal, SEEDREAM_DEMO_MODEL } from "./seedream-client.ts";

export const SEEDREAM_DEMO_PROMPT_VERSION = "seedream-demo-design-director-v1";

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
    .slice(0, 10);
}

export function selectModelInputs<T extends { is_primary?: boolean; sort_order?: number }, A extends { sort_order?: number }>(
  styleReferences: T[],
  assets: A[],
): Array<(T | A) & { input_kind: "style" | "asset" }> {
  const style = selectModelReferences(styleReferences)
    .slice(0, 1)
    .map((item) => ({ ...item, input_kind: "style" as const }));
  const required = [...assets]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .slice(0, Math.max(0, 10 - style.length))
    .map((item) => ({ ...item, input_kind: "asset" as const }));
  return [...style, ...required];
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function compactVisualAnalysis(brief: Record<string, unknown>) {
  const value = brief.visual_reference_analysis;
  if (!value || typeof value !== "object") return "无视觉参考分析；由专业设计判断构图，但不得虚构参考图特征。";
  const a = value as Record<string, any>;
  return [
    `整体风格：${String(a.style_summary || "")}`,
    `风格关键词：${strings(a.style_keywords).join("、")}`,
    `构图规律：${strings(a.composition_patterns).join("；")}`,
    `字体气质：${strings(a.typography_style).join("；")}`,
    `色彩：${strings(a.color_palette).join("、")}`,
    `图片处理：${strings(a.image_treatment).join("；")}`,
    `材质纹理：${strings(a.texture_materials).join("；")}`,
    `图形元素：${strings(a.graphic_elements).join("；")}`,
    `层级：${strings(a.hierarchy_rules).join("；")}`,
    `主参考重点：${String(a.primary_reference_focus || "")}`,
    `禁止照搬：${strings(a.avoid_copying).join("；")}`,
  ].filter((line) => !line.endsWith("：")).join("\n");
}

export function demoPagePrompt(
  brief: Record<string, unknown>,
  page: DemoPage,
  styleReferences: VisualReference[],
  assets: DesignAsset[] = [],
) {
  const visualDirection = strings(brief.visual_direction);
  const layoutPlan = strings(brief.layout_plan);
  const constraints = strings(brief.constraints);
  const audience = strings(brief.audience);
  const successCriteria = strings(brief.success_criteria);
  const recommendations = Array.isArray(brief.recommendations)
    ? brief.recommendations.map((item: any) => String(item?.value || "").trim()).filter(Boolean)
    : [];
  const styleNotes = selectModelReferences(styleReferences).slice(0, 1).map((reference) =>
    `图1 主风格参考：${reference.file_name}${reference.note ? `（${reference.note}）` : ""}。只学习设计语言，不复制其中的内容语义。`
  );
  const assetNotes = [...assets]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .slice(0, 9)
    .map((asset, index) =>
      `图${index + 2} 必用内容资产：${asset.asset_role || "设计素材"} / ${asset.file_name}${asset.note ? `（${asset.note}）` : ""}。保持原始身份和形象特征，不得重绘成另一对象。`
    );
  const exactCopy = page.copy.map((line, index) => `${index + 1}. ${line}`).join("\n");

  return `你是一名资深企业品牌视觉总监兼平面设计师。请直接生成一张可供需求方评审的“完整设计 Demo 页面”，不是草图、不是背景底图、不是素材拼贴板，也不是 Word/PPT 信息页。

【项目目标】
${String(brief.goal || page.title)}

【当前页面】
第 ${page.index} 页：《${page.title}》

【目标受众】
${audience.join("、") || "企业内部员工"}

【本页正式文案】
以下文案是这张页面唯一允许出现的业务文字。必须尽量准确、清晰、完整地呈现，不得把参考图里的原始标题、品牌、地点、人物说明或其他文案带进来：
${exactCopy}

【专业视觉方向】
${visualDirection.join("；") || "根据项目目标做现代、专业、有视觉中心的企业传播设计"}

【版式与信息层级】
${layoutPlan.join("；") || "先建立主视觉与主标题，再组织次级信息；控制信息密度，保留足够留白和安全边距"}

【视觉参考的抽象分析】
${compactVisualAnalysis(brief)}

【参考图与必用素材身份】
${[...styleNotes, ...assetNotes].join("\n") || "无图像输入"}

【硬性限制】
${constraints.join("；") || "无额外限制"}

【验收标准】
${successCriteria.join("；") || "专业、高级、信息层级清楚、品牌资产准确、画面完整"}

【AI设计建议】
${recommendations.join("；") || "无"}

必须执行以下设计原则：
1. 把自己当成真正的设计总监：先形成视觉概念、主次关系、空间结构和节奏，再安排素材；禁止把收到的素材机械地逐个贴进画面。
2. 图1（如果存在）只是“风格参考”。只学习配色、构图、材质、图形语言、字体气质、信息密度和节奏。严禁照搬其中的具体人物、猫、摩托车、建筑、地点、标题、Logo、品牌名称、原始文案或主题语义。
3. 图2及之后（如果存在）是“必用内容资产”。IP、Logo、人物、主视觉或品牌元素必须保持其原始身份和主要形象特征；不要随意换脸、换Logo、重绘成别的角色或生成第二套错误版本。
4. 必用素材是为了服务设计，不代表每个素材都必须同等大。Logo通常是品牌签名；IP可以是视觉焦点或点睛元素，具体大小必须服从本页主题和信息层级。
5. 设计必须有明确主视觉、视觉中心、层次、留白和节奏，达到成熟企业活动海报/品牌传播物料的完成度。禁止廉价拼贴、素材堆砌、模板套壳、Word/PPT式排版。
6. 中文排版要专业：标题有主次，正文有可读性，避免密密麻麻铺满整页；不得新增业务文案，不得用参考图文字填补空白。
7. 对风格参考做“抽象迁移”而不是“语义复制”。即使参考图是复古拼贴，也只能迁移其视觉语法，最终主题、人物、品牌、文案必须完全属于当前项目。
8. 一次只生成这一页完整竖版画面。四周保留安全边距，核心标题、人物/IP、Logo和正文不得被裁切。
9. 优先专业、高级、稳定、品牌统一；如果参考图的某些表现与当前企业品牌调性冲突，以当前项目目标、硬性限制和专业设计判断为准。
10. 输出必须是一张完整可评审的设计页面，文字、图形、素材与背景是一个整体设计，不要生成“待后期再排版”的空底图。`;
}

export function isReusableSeedreamDemo(
  row: Record<string, any> | null | undefined,
  model = SEEDREAM_DEMO_MODEL,
  promptVersion = SEEDREAM_DEMO_PROMPT_VERSION,
) {
  return Boolean(
    row &&
    row.kind === "demo" &&
    row.model === model &&
    row.prompt_version === promptVersion &&
    ["generating", "ready", "confirmed"].includes(String(row.status || "")),
  );
}

export function composeDeterministicDemo(
  background: Record<string, any>,
  _size: { width: number; height: number },
  page: DemoPage,
  assets: DesignAsset[] = [],
  _brief: Record<string, unknown> = {},
) {
  return {
    ...background,
    exact_copy: page.copy.map(String).filter(Boolean),
    asset_count: assets.length,
    text_rendering: "provider_only",
  };
}

function finalPrompt(brief: Record<string, unknown>, demoOutput: Record<string, unknown>) {
  return `根据已确认的需求理解单和已确认 Demo 生成正式成品。保持 Demo 的构图与信息层级，不删减文案。正式成品中的中文文案必须与 exact_copy 完全一致，必用素材必须使用 design_assets 中的原始资产，不得重新想象品牌IP或Logo。\n需求理解：${JSON.stringify(brief)}\n确认 Demo：${JSON.stringify(demoOutput)}`;
}

async function findIdempotent(admin: any, key: string) {
  if (!key) return null;
  return (await admin.from("uat_design_generations").select("*").eq("idempotency_key", key).maybeSingle()).data;
}

async function findActiveDemo(admin: any, taskId: string, analysisId: string, pageIndex: number, model: string) {
  const row = (await admin.from("uat_design_generations")
    .select("*")
    .eq("task_id", taskId)
    .eq("analysis_id", analysisId)
    .eq("kind", "demo")
    .eq("page_index", pageIndex)
    .eq("model", model)
    .eq("prompt_version", SEEDREAM_DEMO_PROMPT_VERSION)
    .in("status", ["generating", "ready", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()).data;
  return isReusableSeedreamDemo(row, model, SEEDREAM_DEMO_PROMPT_VERSION) ? row : null;
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

async function generateDemoPage(
  admin: any,
  taskId: string,
  analysis: any,
  page: DemoPage,
  pageCount: number,
  references: VisualReference[],
  assets: DesignAsset[],
  userJwt: string,
) {
  const model = SEEDREAM_DEMO_MODEL;
  const existing = await findActiveDemo(admin, taskId, analysis.id, page.index, model);
  if (existing) return existing;

  const idempotencyKey = crypto.randomUUID();
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysis.id,
    kind: "demo",
    model,
    prompt_version: SEEDREAM_DEMO_PROMPT_VERSION,
    idempotency_key: idempotencyKey,
    page_index: page.index,
    page_count: pageCount,
    status: "generating",
  }).select("*").single();
  if (queued.error) throw queued.error;

  try {
    const size = resolveDemoSize(analysis.brief);
    const modelInputs = selectModelInputs(references, assets);
    const prompt = demoPagePrompt(analysis.brief, page, references, assets);
    const generated = await generateSeedreamDemo(
      prompt,
      size,
      modelInputs.map((item: ModelInput) => ({
        file_name: item.file_name,
        data_url: item.data_url,
        input_kind: item.input_kind,
        role: item.input_kind === "asset" ? String((item as DesignAsset).asset_role || item.file_name) : "主风格参考",
      })),
      { taskId, pageIndex: page.index, pageCount },
      userJwt,
    );

    const output = {
      ...generated,
      page_index: page.index,
      page_count: pageCount,
      page_title: page.title,
      exact_copy: page.copy,
      style_reference_count: references.length,
      design_asset_count: assets.length,
      model_input_count: modelInputs.length,
      prompt_version: SEEDREAM_DEMO_PROMPT_VERSION,
    };
    const updated = await admin.from("uat_design_generations").update({
      status: "ready",
      output,
      updated_at: new Date().toISOString(),
    }).eq("id", queued.data.id).select("*").single();
    if (updated.error) throw updated.error;
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo generation failed";
    await admin.from("uat_design_generations").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", queued.data.id);
    throw error;
  }
}

export async function generateDemoSet(admin: any, taskId: string, analysisId: string, userJwt: string) {
  if (!String(userJwt || "").trim()) throw new Error("UAT_JWT_REQUIRED");
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", analysisId).eq("task_id", taskId).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  assertCanGenerateDemo(analysis.status);

  const task = (await admin.from("test_tasks").select("request_type").eq("id", taskId).single()).data;
  const [references, assets] = await Promise.all([loadVisualReferences(admin, taskId), loadDesignAssets(admin, taskId)]);
  if ((task?.request_type === "平面视觉" || !task?.request_type) && references.length === 0) throw new Error("VISUAL_REFERENCE_REQUIRED");
  if (references.length > 0 && !analysis.brief?.visual_reference_analysis) throw new Error("QWEN_VISUAL_ANALYSIS_REQUIRED");

  const pages = selectGenerationPages(analysis.brief);
  const results = [];
  for (const page of pages) {
    results.push(await generateDemoPage(admin, taskId, analysis, page, pages.length, references, assets, userJwt));
  }
  return results;
}

export async function generateDemo(admin: any, taskId: string, analysisId: string, idempotencyKey: string, userJwt = "") {
  const existing = idempotencyKey ? await findIdempotent(admin, idempotencyKey) : null;
  if (existing && isReusableSeedreamDemo(existing)) return existing;
  const set = await generateDemoSet(admin, taskId, analysisId, userJwt);
  return set[0];
}

export async function confirmDemo(admin: any, taskId: string, generationId: string, userId: string) {
  const demo = (await admin.from("uat_design_generations").select("*").eq("id", generationId).eq("task_id", taskId).eq("kind", "demo").single()).data;
  if (!demo || demo.status !== "ready") throw new Error("READY_DEMO_REQUIRED");
  const updated = await admin.from("uat_design_generations").update({
    status: "confirmed",
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", generationId).select("*").single();
  if (updated.error) throw updated.error;
  return updated.data;
}

export async function generateFinal(admin: any, taskId: string, demoGenerationId: string, idempotencyKey: string) {
  const existing = idempotencyKey ? await findIdempotent(admin, idempotencyKey) : null;
  if (existing) return existing;
  const demo = (await admin.from("uat_design_generations").select("*").eq("id", demoGenerationId).eq("task_id", taskId).single()).data;
  if (!demo) throw new Error("DEMO_NOT_FOUND");
  assertCanGenerateFinal(demo.status, demo.kind);
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", demo.analysis_id).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  const model = Deno.env.get("SEEDREAM_MODEL") || "unconfigured";
  const key = idempotencyKey || crypto.randomUUID();
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysis.id,
    parent_generation_id: demo.id,
    kind: "final",
    model,
    prompt_version: "seedream-final-v2-exact-copy-assets",
    idempotency_key: key,
    page_index: demo.page_index,
    page_count: demo.page_count,
    status: "generating",
  }).select("*").single();
  if (queued.error) {
    const raced = await findIdempotent(admin, key);
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
