import { createClient } from "npm:@supabase/supabase-js@2";
import { ingestTaskSources } from "./source-service.ts";
import { analyzeRequirement, answerClarification, confirmUnderstanding } from "./analysis-service.ts";
import { isAutomaticAnalysisAction, shouldRefreshSourcesForAction } from "./workflow-actions.ts";
import { delegateSoftQuestions, requesterAck, saveAiProcessingAck, saveRequesterAnswers } from "./clarification-chat.ts";
import { handleTemplateWorkflowAction, isTemplateWorkflowAction } from "./template-workflow-router.ts";
import { mirrorFormalAiMessage } from "./formal-ai-message.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

const AI_EMAIL = "davis.design.ai@webank.com";
const REQUESTER_EMAIL = "uat.requester@webank.com";
const LEGACY_REQUESTER_ACTIONS = new Set([
  "answer_clarifications", "delegate_to_ai",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return out({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth.user) return out({ ok: false, error: "Authenticated UAT account required" }, 401);

  let body: any = {};
  try { body = await request.json(); } catch { return out({ ok: false, error: "INVALID_JSON" }, 400); }
  const task_id = String(body.task_id || "").trim();
  const action = String(body.action || "analyze").trim();
  if (!task_id) return out({ ok: false, error: "TASK_ID_REQUIRED" }, 400);

  const actorEmail = String(auth.user.email || "").toLowerCase();
  const { data: task } = await admin.from("test_tasks").select("*").eq("id", task_id).single();
  if (!task) return out({ ok: false, error: "TASK_NOT_FOUND" }, 404);

  if (isTemplateWorkflowAction(action)) {
    const routed = await handleTemplateWorkflowAction({
      admin, task, taskId: task_id, action, body, auth, jwt,
    });
    if (routed.handled) return out(routed.body, routed.status);
  }

  const isAiDesigner = actorEmail === AI_EMAIL;
  const isRequesterAllowed = actorEmail === REQUESTER_EMAIL && LEGACY_REQUESTER_ACTIONS.has(action);
  if (!isAiDesigner && !isRequesterAllowed) return out({ ok: false, error: "UAT_AI_ACTION_FORBIDDEN" }, 403);
  if (task.assignee !== "davis.design.ai") return out({ ok: false, error: "Task is not assigned to UAT AI" }, 400);

  const requiresVisualReference = task.request_type === "平面视觉" || (!task.request_type && Array.isArray(task.channels) && task.channels.includes("小蓝书"));
  const getVisualReferenceCount = async () => (await admin.from("uat_visual_references").select("id", { count: "exact", head: true }).eq("task_id", task_id)).count || 0;
  const pauseForVisualReference = async () => {
    await admin.from("test_tasks").update({
      status: "waiting_visual_reference",
      summary_desc: "AI 已收到需求，等待需求方上传至少1张视觉风格参考图",
    }).eq("id", task_id);
    return out({ ok: true, status: "waiting_visual_reference", reason: "VISUAL_REFERENCE_REQUIRED" }, 202);
  };

  let history: Array<Record<string, unknown>> = [];
  try { history = JSON.parse(task.history_json || "[]"); } catch { history = []; }

  const executeAnalysis = async () => {
    try {
      if (requiresVisualReference && await getVisualReferenceCount() === 0) {
        await admin.from("test_tasks").update({
          status: "waiting_visual_reference",
          summary_desc: "AI 等待视觉风格参考图后继续理解需求",
        }).eq("id", task_id);
        return { ok: true, status: "waiting_visual_reference" };
      }
      if (shouldRefreshSourcesForAction(action)) await ingestTaskSources(admin, task, auth.user.id);
      const analysis = await analyzeRequirement(admin, task, jwt);
      const nextStatus = analysis.status === "clarification_required" ? "needs_input" : "understanding_ready";
      history.push({
        action: "ai_requirement_analysis",
        operator: "Davis AI设计师 (UAT)",
        analysis_id: analysis.id,
        version: analysis.version,
        status: analysis.status,
        time: new Date().toISOString(),
      });
      await admin.from("test_tasks").update({
        status: nextStatus,
        summary_desc: nextStatus === "needs_input"
          ? "AI 已完成需求理解，等待需求方补充关键信息"
          : "AI 已完成需求理解；不会自动生图，等待明确确认和生成动作",
        history_json: JSON.stringify(history),
      }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        action: "ai_requirement_analysis",
        task_id,
        details: { analysis_id: analysis.id, version: analysis.version, status: analysis.status, automatic: isAutomaticAnalysisAction(action), generation_started: false },
      });
      if (["answer_clarifications", "delegate_to_ai"].includes(action)) {
        const aiReply = nextStatus === "needs_input"
          ? "我已结合你的补充重新理解需求，仍有少量关键信息需要确认。"
          : "我已重新理解完成。信息足够，但系统不会自动生图，等待明确生成动作。";
        const replyResult = await admin.from("uat_clarification_messages").insert({
          task_id,
          analysis_id: analysis.id,
          sender_role: "ai_designer",
          message_type: "summary",
          content: aiReply,
          metadata: { status: nextStatus, version: analysis.version, generation_started: false },
        }).select("id").single();
        if (replyResult.error) throw replyResult.error;
        await mirrorFormalAiMessage(admin, { id: replyResult.data.id, taskId: task_id, senderRole: "ai_designer", content: aiReply });
      }
      return { ok: true, status: nextStatus, analysis };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Requirement analysis failed";
      await admin.from("test_tasks").update({ status: "analysis_failed", summary_desc: "AI 自动理解失败，可在 AI 工作台重试" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        action: "ai_requirement_analysis_failed",
        task_id,
        details: { error: message, automatic: isAutomaticAnalysisAction(action) },
      });
      return { ok: false, error: message };
    }
  };

  if (action === "read_sources") {
    try {
      const sources = await ingestTaskSources(admin, task, auth.user.id);
      await admin.from("uat_audit_log").insert({ actor_id: auth.user.id, actor_email: auth.user.email, action: "source_read_completed", task_id, details: { sources } });
      return out({ ok: true, status: "source_read_completed", sources });
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Source ingestion failed" }, 400);
    }
  }

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
    if (requiresVisualReference && await getVisualReferenceCount() === 0) return await pauseForVisualReference();
    await admin.from("test_tasks").update({ status: "processing", summary_desc: "AI 正在自动读取资料、风格参考和必用素材" }).eq("id", task_id);
    EdgeRuntime.waitUntil(executeAnalysis());
    return out({ ok: true, status: "processing", generation_started: false }, 202);
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
      await admin.from("test_tasks").update({ status: "ready_for_demo", summary_desc: "需求理解已确认；等待用户明确点击生成 Demo" }).eq("id", task_id);
      await admin.from("uat_audit_log").insert({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        action: "requirement_understanding_confirmed",
        task_id,
        details: { analysis_id: analysis.id, version: analysis.version, generation_started: false },
      });
      return out({ ok: true, status: "ready_for_demo", analysis, generation_started: false });
    } catch (error) {
      return out({ ok: false, error: error instanceof Error ? error.message : "Understanding confirmation failed" }, 400);
    }
  }

  if (action === "generate_demo") {
    return out({ ok: false, error: "LEGACY_GENERATE_DEMO_DISABLED_USE_EXPLICIT_DEMO_QUEUE" }, 409);
  }
  if (action === "confirm_demo" || action === "generate_final") {
    return out({ ok: false, error: "LEGACY_FINAL_FLOW_DISABLED_TEMPLATE_WORKFLOW_ACTIVE" }, 409);
  }
  if (action === "submit_framework") {
    return out({ ok: false, error: "LEGACY_SUBMIT_FRAMEWORK_DISABLED_WORKER_OWNS_VERSION" }, 409);
  }

  if (action === "analyze" || action === "reanalyze") {
    const result = await executeAnalysis();
    return out(result, result.ok ? 200 : result.error === "DEEPSEEK_MODEL_NOT_CONFIGURED" ? 503 : 400);
  }

  return out({ ok: false, error: "Unsupported AI workflow action" }, 400);
});
