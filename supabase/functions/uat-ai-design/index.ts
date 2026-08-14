import { createClient } from "npm:@supabase/supabase-js@2";
import { ingestTaskSources } from "./source-service.ts";
import { analyzeRequirement, answerClarification, confirmUnderstanding } from "./analysis-service.ts";
import { confirmDemo, generateDemo, generateFinal } from "./generation-service.ts";
import { isAutomaticAnalysisAction, shouldRefreshSourcesForAction } from "./workflow-actions.ts";
import { delegateSoftQuestions, requesterAck, saveAiProcessingAck, saveRequesterAnswers } from "./clarification-chat.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth.user) return out({ ok: false, error: "Authenticated UAT account required" }, 401);
  const body = await request.json();
  const { task_id, action = "analyze" } = body;
  const actorEmail = String(auth.user.email || "").toLowerCase();
  const isAiDesigner = actorEmail === "davis.design.ai@webank.com";
  const isRequesterAutoTrigger = actorEmail === "uat.requester@webank.com" && ["auto_analyze", "answer_clarifications", "delegate_to_ai", "analyze", "reanalyze", "read_sources", "answer_clarification", "confirm_understanding", "generate_demo", "confirm_demo", "generate_final"].includes(action);
  if (!isAiDesigner && !isRequesterAutoTrigger) return out({ ok: false, error: "UAT AI account or requester auto-trigger required" }, 403);
  const { data: task } = await admin.from("test_tasks").select("*").eq("id", task_id).single();
  if (!task || task.assignee !== "davis.design.ai") return out({ ok: false, error: "Task is not assigned to UAT AI" }, 400);
  if (action === "read_sources") {
    try {
      const sources = await ingestTaskSources(admin, task, auth.user.id);
      await admin.from("uat_audit_log").insert({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        action: "source_read_completed",
        task_id,
        details: { sources },
      });
      return out({ ok: true, status: "source_read_completed", sources });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source ingestion failed";
      return out({ ok: false, error: message }, 400);
    }
  }
  let history: Array<Record<string, unknown>> = [];
  try { history = JSON.parse(task.history_json || "[]"); } catch { /* Preserve empty history. */ }
  const executeAnalysis = async () => {
    try {
      if (shouldRefreshSourcesForAction(action)) await ingestTaskSources(admin, task, auth.user.id);
      const analysis = await analyzeRequirement(admin, task, jwt);
      const nextStatus = analysis.status === "clarification_required" ? "needs_input" : "understanding_ready";
      history.push({ action: "ai_requirement_analysis", operator: "Davis AI设计师 (UAT)", analysis_id: analysis.id, version: analysis.version, status: analysis.status, time: new Date().toISOString() });
      await admin.from("test_tasks").update({
        status: nextStatus,
        summary_desc: nextStatus === "needs_input" ? "AI 已自动理解需求，等待需求方补充信息" : "AI 已自动生成需求理解单，等待需求方确认",
        history_json: JSON.stringify(history),
      }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "ai_requirement_analysis", task_id, details: { analysis_id: analysis.id, version: analysis.version, status: analysis.status, automatic: isAutomaticAnalysisAction(action) } });
      if (["answer_clarifications", "delegate_to_ai"].includes(action)) {
        await admin.from("uat_clarification_messages").insert({ task_id, analysis_id: analysis.id, sender_role: "ai_designer", message_type: "summary", content: nextStatus === "needs_input" ? "我已结合你的补充重新理解需求，仍有少量会影响出图的关键信息需要确认。" : "我已理解完成并形成可执行方案，请确认理解单后进入 Demo 出图。", metadata: { status: nextStatus, version: analysis.version } });
      }
      if (analysis.status === "understanding_ready") {
        await confirmUnderstanding(admin, task_id, analysis.id, auth.user.id);
        await admin.from("test_tasks").update({ status: "generating_demo", summary_desc: "AI 已理解需求，正在生成 Cloudflare Demo" }).eq("id", task_id);
        await admin.from("uat_clarification_messages").insert({ task_id, analysis_id: analysis.id, sender_role: "ai_designer", message_type: "status", content: "信息已经够了，我现在开始生成第一版设计图。", metadata: { status: "generating_demo", version: analysis.version } });
        const generation = await generateDemo(admin, task_id, analysis.id, `auto-demo:${analysis.id}`);
        await admin.from("test_tasks").update({ status: "demo_review", summary_desc: "Cloudflare Demo 已生成，等待需求方查看" }).eq("id", task_id);
        await admin.from("uat_clarification_messages").insert({ task_id, analysis_id: analysis.id, sender_role: "ai_designer", message_type: "summary", content: "第一版 Demo 已生成，请查看设计效果。", metadata: { status: "demo_review", generation_id: generation.id } });
        return { ok: true, status: "demo_review", analysis, generation };
      }
      return { ok: true, status: analysis.status, analysis };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Requirement analysis failed";
      await admin.from("test_tasks").update({ status: "analysis_failed", summary_desc: "AI 自动理解失败，可在 AI 工作台重试" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "ai_requirement_analysis_failed", task_id, details: { error: message, automatic: isAutomaticAnalysisAction(action) } });
      return { ok: false, error: message };
    }
  };
  if (action === "answer_clarifications" || action === "delegate_to_ai") {
    try {
      const clientRequestId = String(body.client_request_id || "");
      const message = action === "answer_clarifications"
        ? await saveRequesterAnswers(admin, task_id, body.answers || [], String(body.message || ""), clientRequestId, auth.user.id)
        : await delegateSoftQuestions(admin, task_id, clientRequestId, auth.user.id);
      await saveAiProcessingAck(admin, task_id, clientRequestId, action);
      history.push({ action: "ai_clarification_answered", operator: "UAT 需求方", reply: "已补充 AI 需求信息，AI 正在重新理解", time: new Date().toISOString() });
      await admin.from("test_tasks").update({ status: "processing", summary_desc: "AI 已收到补充信息，正在重新理解需求", history_json: JSON.stringify(history) }).eq("id", task_id);
      EdgeRuntime.waitUntil(executeAnalysis());
      return out(requesterAck(message.id), 202);
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Clarification chat failed" }, 400);
    }
  }
  if (isAutomaticAnalysisAction(action)) {
    await admin.from("test_tasks").update({ status: "processing", summary_desc: "AI 正在自动读取资料并理解需求" }).eq("id", task_id);
    EdgeRuntime.waitUntil(executeAnalysis());
    return out({ ok: true, status: "processing" }, 202);
  }
  if (action === "answer_clarification") {
    try {
      const clarification = await answerClarification(admin, task_id, String(body.clarification_id || ""), String(body.answer || ""), auth.user.id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "clarification_answered", task_id, details: { clarification_id: clarification.id } });
      return out({ ok: true, status: "clarification_answered", clarification });
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Clarification answer failed" }, 400);
    }
  }
  if (action === "confirm_understanding") {
    try {
      const analysis = await confirmUnderstanding(admin, task_id, String(body.analysis_id || ""), auth.user.id);
      await admin.from("test_tasks").update({ status: "ready_for_demo", summary_desc: "需求理解已确认，可以生成 Demo" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "requirement_understanding_confirmed", task_id, details: { analysis_id: analysis.id, version: analysis.version } });
      return out({ ok: true, status: "confirmed", analysis });
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Understanding confirmation failed" }, 400);
    }
  }
  if (action === "generate_demo") {
    try {
      const generation = await generateDemo(admin, task_id, String(body.analysis_id || ""), String(body.idempotency_key || ""));
      await admin.from("test_tasks").update({ status: "demo_review", summary_desc: "Cloudflare Demo 已生成，等待需求方确认" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "demo_generated", task_id, details: { generation_id: generation.id, model: generation.model } });
      return out({ ok: true, status: generation.status, generation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Demo generation failed";
      return out({ ok: false, error: message }, message.includes("NOT_CONFIGURED") ? 503 : 400);
    }
  }
  if (action === "confirm_demo") {
    try {
      const generation = await confirmDemo(admin, task_id, String(body.generation_id || ""), auth.user.id);
      await admin.from("test_tasks").update({ status: "ready_for_final", summary_desc: "Demo 已确认，可以生成 Seedream 4.0 成品" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "demo_confirmed", task_id, details: { generation_id: generation.id } });
      return out({ ok: true, status: "confirmed", generation });
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Demo confirmation failed" }, 400);
    }
  }
  if (action === "generate_final") {
    try {
      const generation = await generateFinal(admin, task_id, String(body.demo_generation_id || ""), String(body.idempotency_key || ""));
      await admin.from("test_tasks").update({ status: "final_review", summary_desc: "Seedream 4.0 成品已生成，等待验收", design_img_url: generation.output?.image_url || null }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "final_generated", task_id, details: { generation_id: generation.id, model: generation.model } });
      return out({ ok: true, status: generation.status, generation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Final generation failed";
      return out({ ok: false, error: message }, message.includes("NOT_CONFIGURED") ? 503 : 400);
    }
  }
  if (action === "submit_framework") {
    const job = (await admin.from("ai_design_jobs").select("*").eq("task_id", task_id).single()).data;
    const framework = job?.analysis?.framework;
    if (!framework) return out({ ok: false, error: "Generate preview first" }, 400);
    history.push({ action: "submit_framework", operator: "Davis AI设计师 (UAT)", version: framework.version, time: new Date().toISOString(), img_url: framework.image_url, desc: "UAT 框架方案提交给虚拟测试领导。" });
    await admin.from("test_tasks").update({ status: "pending_approval", summary_desc: "UAT 框架待虚拟测试领导审核", design_img_url: framework.image_url, history_json: JSON.stringify(history) }).eq("id", task_id);
    await admin.from("ai_design_jobs").update({ status: "framework_submitted" }).eq("task_id", task_id);
    return out({ ok: true, status: "framework_submitted" });
  }
  if (action === "analyze" || action === "reanalyze") {
    const result = await executeAnalysis();
    return out(result, result.ok ? 200 : result.error === "DEEPSEEK_MODEL_NOT_CONFIGURED" ? 503 : 400);
  }
  return out({ ok: false, error: "Unsupported AI workflow action" }, 400);
});
