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
  if (channels.some((channel) => channel.includes("小蓝书"))) {
    return { width: 1242, height: 1660 };
  }

  throw new Error("DEMO_SIZE_REQUIRED");
}

export function demoPrompt(brief: Record<string, unknown>) {
  const compactBrief = JSON.stringify(brief).slice(0, 1200);
  return `根据已经由需求方确认的需求理解单生成低成本版式 Demo。只验证构图、信息层级和风格方向；正文必须完整，不输出成品级细节。\n${compactBrief}`;
}

function finalPrompt(brief: Record<string, unknown>, demoOutput: Record<string, unknown>) {
  return `根据已确认的需求理解单和已确认 Demo 生成正式成品。保持 Demo 的构图与信息层级，不删减文案。\n需求理解：${JSON.stringify(brief)}\n确认 Demo：${JSON.stringify(demoOutput)}`;
}

async function findIdempotent(admin: any, key: string) {
  return (await admin.from("uat_design_generations").select("*").eq("idempotency_key", key).maybeSingle()).data;
}

async function findActiveDemo(admin: any, taskId: string, analysisId: string) {
  return (await admin.from("uat_design_generations")
    .select("*")
    .eq("task_id", taskId)
    .eq("analysis_id", analysisId)
    .eq("kind", "demo")
    .in("status", ["generating", "ready", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()).data;
}

export async function generateDemo(admin: any, taskId: string, analysisId: string, idempotencyKey: string) {
  const existing = await findIdempotent(admin, idempotencyKey);
  if (existing) return existing;
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", analysisId).eq("task_id", taskId).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  assertCanGenerateDemo(analysis.status);

  const activeDemo = await findActiveDemo(admin, taskId, analysisId);
  if (activeDemo) return activeDemo;

  const model = Deno.env.get("CLOUDFLARE_DEMO_MODEL") || "unconfigured";
  const queued = await admin.from("uat_design_generations").insert({
    task_id: taskId,
    analysis_id: analysisId,
    kind: "demo",
    model,
    prompt_version: "demo-layout-v2",
    idempotency_key: idempotencyKey,
    status: "generating",
  }).select("*").single();
  if (queued.error) {
    const raced = await findIdempotent(admin, idempotencyKey) || await findActiveDemo(admin, taskId, analysisId);
    if (raced) return raced;
    throw queued.error;
  }
  try {
    const size = resolveDemoSize(analysis.brief);
    const output = await generateCloudflareDemo(demoPrompt(analysis.brief), size);
    const updated = await admin.from("uat_design_generations").update({ status: "ready", output, updated_at: new Date().toISOString() }).eq("id", queued.data.id).select("*").single();
    if (updated.error) throw updated.error;
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo generation failed";
    await admin.from("uat_design_generations").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", queued.data.id);
    throw error;
  }
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
