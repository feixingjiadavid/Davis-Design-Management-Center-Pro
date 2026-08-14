import type { NormalizedSourceDocument, SourceReadResult } from "./source-types.ts";
import { readTencentPublic } from "./tencent-public-reader.ts";
import { readAuthorizedTencentDocument } from "./tencent-oauth-adapter.ts";

export interface UatTaskSourceInput {
  id: string;
  title?: string | null;
  full_desc?: string | null;
  project?: string | null;
  channels?: unknown;
  due_date?: string | null;
  link?: string | null;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildFormSourceDocument(task: UatTaskSourceInput): Promise<NormalizedSourceDocument> {
  const fields = {
    task_id: task.id,
    title: task.title || "",
    description: task.full_desc || "",
    project: task.project || "",
    channels: Array.isArray(task.channels) ? task.channels : [],
    due_date: task.due_date || "",
  };
  const plainText = [
    `需求编号：${fields.task_id}`,
    `需求标题：${fields.title}`,
    `需求描述：${fields.description}`,
    `归属项目：${fields.project}`,
    `分发渠道：${fields.channels.join("、")}`,
    `期望交付日：${fields.due_date}`,
  ].join("\n");
  return {
    title: fields.title || `需求 ${fields.task_id}`,
    plainText,
    structuredBlocks: [{ type: "form_fields", text: JSON.stringify(fields), inferred: false }],
    imageObservations: [],
    contentSha256: await sha256(plainText),
    counts: { characterCount: plainText.length, tableCount: 0, imageCount: 0, attachmentCount: 0 },
  };
}

async function findOrCreateSource(admin: any, taskId: string, sourceType: "form_fields" | "tencent_doc", sourceUrl: string | null, userId: string) {
  let query = admin.from("uat_requirement_sources").select("*").eq("task_id", taskId).eq("source_type", sourceType);
  query = sourceUrl ? query.eq("source_url", sourceUrl) : query.is("source_url", null);
  const existing = (await query.maybeSingle()).data;
  if (existing) return existing;
  const inserted = await admin.from("uat_requirement_sources").insert({ task_id: taskId, source_type: sourceType, source_url: sourceUrl, status: "pending", created_by: userId }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function persistReadResult(admin: any, source: any, result: SourceReadResult) {
  if (result.status !== "ready") {
    await admin.from("uat_requirement_sources").update({ status: result.status, error_code: result.errorCode, error_message: result.errorMessage, updated_at: new Date().toISOString() }).eq("id", source.id);
    return { sourceId: source.id, status: result.status, errorCode: result.errorCode, errorMessage: result.errorMessage };
  }
  const document = result.document;
  const existing = (await admin.from("uat_source_snapshots").select("id").eq("source_id", source.id).eq("content_sha256", document.contentSha256).maybeSingle()).data;
  let snapshotId = existing?.id;
  if (!snapshotId) {
    const inserted = await admin.from("uat_source_snapshots").insert({
      source_id: source.id,
      title: document.title,
      plain_text: document.plainText,
      structured_blocks: document.structuredBlocks,
      image_observations: document.imageObservations,
      content_sha256: document.contentSha256,
      character_count: document.counts.characterCount,
      table_count: document.counts.tableCount,
      image_count: document.counts.imageCount,
      attachment_count: document.counts.attachmentCount,
    }).select("id").single();
    if (inserted.error) throw inserted.error;
    snapshotId = inserted.data.id;
    await admin.from("uat_requirement_analyses").update({ status: "stale", updated_at: new Date().toISOString() }).eq("task_id", source.task_id).in("status", ["clarification_required", "understanding_ready", "confirmed"]);
  }
  await admin.from("uat_requirement_sources").update({ status: "ready", current_snapshot_id: snapshotId, error_code: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", source.id);
  return { sourceId: source.id, snapshotId, status: "ready", counts: document.counts };
}

export async function ingestTaskSources(admin: any, task: UatTaskSourceInput, userId: string, fetcher: typeof fetch = fetch) {
  const formSource = await findOrCreateSource(admin, task.id, "form_fields", null, userId);
  await admin.from("uat_requirement_sources").update({ status: "reading", updated_at: new Date().toISOString() }).eq("id", formSource.id);
  const formDocument = await buildFormSourceDocument(task);
  const results = [await persistReadResult(admin, formSource, { status: "ready", document: formDocument })];

  if (task.link?.trim()) {
    const sourceUrl = task.link.trim();
    const linkSource = await findOrCreateSource(admin, task.id, "tencent_doc", sourceUrl, userId);
    await admin.from("uat_requirement_sources").update({ status: "reading", updated_at: new Date().toISOString() }).eq("id", linkSource.id);
    const token = typeof Deno !== "undefined" ? Deno.env.get("TENCENT_DOCS_TOKEN") || "" : "";
    const linkResult = token ? await readAuthorizedTencentDocument(sourceUrl, token, fetcher) : await readTencentPublic(sourceUrl, fetcher);
    results.push(await persistReadResult(admin, linkSource, linkResult));
  }
  return results;
}
