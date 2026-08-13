import { callCloudflareRequirementModel } from "./cloudflare-client.ts";
import { buildRequirementPrompt, REQUIREMENT_PROMPT_VERSION } from "./requirement-prompt.ts";
import type { RequirementBrief } from "./requirement-schema.ts";

export function decideAnalysisStatus(brief: RequirementBrief) {
  return brief.missing_information.length > 0 || brief.conflicts.length > 0 || brief.clarification_questions.length > 0
    ? "clarification_required"
    : "understanding_ready";
}

export function selectOpenTalkTemplates<T extends { template_family?: string; template_type?: string }>(templates: T[], type: "预告" | "回顾") {
  return templates.filter((template) => template.template_family === "OpenTalk" && template.template_type === type);
}

export function assertUnderstandingCanBeConfirmed(status: string, openClarificationCount: number) {
  if (status !== "understanding_ready") throw new Error("ANALYSIS_NOT_READY_FOR_CONFIRMATION");
  if (openClarificationCount > 0) throw new Error("OPEN_CLARIFICATIONS_REMAIN");
}

export async function answerClarification(admin: any, taskId: string, clarificationId: string, answer: string, userId: string) {
  if (!answer.trim()) throw new Error("CLARIFICATION_ANSWER_REQUIRED");
  const row = (await admin.from("uat_clarifications").select("*").eq("id", clarificationId).eq("task_id", taskId).eq("status", "open").single()).data;
  if (!row) throw new Error("OPEN_CLARIFICATION_NOT_FOUND");
  const updated = await admin.from("uat_clarifications").update({
    answer: answer.trim(),
    status: "answered",
    answered_by: userId,
    answered_at: new Date().toISOString(),
  }).eq("id", clarificationId).eq("task_id", taskId).select("*").single();
  if (updated.error) throw updated.error;
  return updated.data;
}

export async function confirmUnderstanding(admin: any, taskId: string, analysisId: string, userId: string) {
  const analysis = (await admin.from("uat_requirement_analyses").select("*").eq("id", analysisId).eq("task_id", taskId).single()).data;
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND");
  const openCount = (await admin.from("uat_clarifications").select("id", { count: "exact", head: true }).eq("analysis_id", analysisId).eq("status", "open")).count || 0;
  assertUnderstandingCanBeConfirmed(analysis.status, openCount);
  const updated = await admin.from("uat_requirement_analyses").update({
    status: "confirmed",
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", analysisId).eq("task_id", taskId).select("*").single();
  if (updated.error) throw updated.error;
  return updated.data;
}

export async function analyzeRequirement(admin: any, task: Record<string, any>) {
  const sourceRows = (await admin.from("uat_requirement_sources")
    .select("id,source_type,current_snapshot_id")
    .eq("task_id", task.id)
    .eq("status", "ready")
    .not("current_snapshot_id", "is", null)).data || [];
  if (sourceRows.length === 0) throw new Error("SOURCE_REQUIRED");
  const snapshotIds = sourceRows.map((source: any) => source.current_snapshot_id);
  const snapshots = (await admin.from("uat_source_snapshots").select("*").in("id", snapshotIds)).data || [];
  const sources = sourceRows.map((source: any) => {
    const snapshot = snapshots.find((item: any) => item.id === source.current_snapshot_id);
    return {
      id: source.id,
      sourceType: source.source_type,
      document: {
        title: snapshot.title,
        plainText: snapshot.plain_text,
        structuredBlocks: snapshot.structured_blocks,
        imageObservations: snapshot.image_observations,
        contentSha256: snapshot.content_sha256,
        counts: {
          characterCount: snapshot.character_count,
          tableCount: snapshot.table_count,
          imageCount: snapshot.image_count,
          attachmentCount: snapshot.attachment_count,
        },
      },
    };
  });
  const templates = (await admin.from("design_templates")
    .select("id,template_family,template_type,name,canvas_width,canvas_height,rules,status")
    .in("status", ["testing", "approved"])).data || [];
  const answeredClarifications = (await admin.from("uat_clarifications")
    .select("question,answer,answered_at")
    .eq("task_id", task.id)
    .eq("status", "answered")
    .order("answered_at", { ascending: true })).data || [];
  const prompt = buildRequirementPrompt({ ...task, answered_clarifications: answeredClarifications }, sources, templates);
  const model = Deno.env.get("CLOUDFLARE_REQUIREMENT_MODEL") || "";
  const result = await callCloudflareRequirementModel(prompt, {
    accountId: Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "",
    apiToken: Deno.env.get("CLOUDFLARE_API_TOKEN") || "",
    model,
    gatewayId: Deno.env.get("CLOUDFLARE_AI_GATEWAY_ID") || undefined,
  });
  const current = (await admin.from("uat_requirement_analyses").select("version").eq("task_id", task.id).order("version", { ascending: false }).limit(1).maybeSingle()).data;
  const version = (current?.version || 0) + 1;
  const status = decideAnalysisStatus(result.brief);
  const inserted = await admin.from("uat_requirement_analyses").insert({
    task_id: task.id,
    snapshot_ids: snapshotIds,
    version,
    status,
    model,
    prompt_version: REQUIREMENT_PROMPT_VERSION,
    brief: result.brief,
    confidence: result.brief.confidence,
    usage: result.usage,
  }).select("*").single();
  if (inserted.error) throw inserted.error;
  if (result.brief.clarification_questions.length > 0) {
    await admin.from("uat_clarifications").insert(result.brief.clarification_questions.map((question) => ({ task_id: task.id, analysis_id: inserted.data.id, question, status: "open" })));
  }
  await admin.from("ai_design_jobs").upsert({
    task_id: task.id,
    status: status === "clarification_required" ? "needs_input" : "ready_for_generation",
    request_snapshot: task,
    analysis: { requirement_analysis_id: inserted.data.id, version, brief: result.brief },
    attempt_count: 1,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }, { onConflict: "task_id" });
  return inserted.data;
}
