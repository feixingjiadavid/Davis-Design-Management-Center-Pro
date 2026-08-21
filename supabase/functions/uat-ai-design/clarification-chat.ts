import { canDelegateQuestion } from "./clarification-policy.ts";
import { buildFormalRequesterMessageContents, mirrorFormalAiMessage } from "./formal-ai-message.mjs";

export type ClarificationAnswer = { clarification_id: string; answer: string };

export function normalizeAnswers(input: unknown): ClarificationAnswer[] {
  if (!Array.isArray(input)) throw new Error("CLARIFICATION_ANSWERS_REQUIRED");
  return input.map((item: any) => {
    const clarification_id = String(item?.clarification_id || "").trim();
    const answer = String(item?.answer || "").trim();
    if (!clarification_id) throw new Error("CLARIFICATION_ID_REQUIRED");
    if (!answer) throw new Error("CLARIFICATION_ANSWER_REQUIRED");
    return { clarification_id, answer };
  });
}

export function requesterAck(messageId: string) {
  return { ok: true, status: "processing", message_id: messageId, reply: "AI 已收到，正在理解" };
}

export async function saveAiProcessingAck(admin: any, taskId: string, clientRequestId: string, action: string) {
  const ackRequestId = `${clientRequestId}:ai-ack`;
  const existing = (await admin.from("uat_clarification_messages").select("id").eq("task_id", taskId).eq("client_request_id", ackRequestId).maybeSingle()).data;
  if (existing) return existing;
  const content = action === "delegate_to_ai"
    ? "收到，我会按历史模板和专业判断补齐这些信息，现在继续处理。"
    : "收到你的补充，我正在结合已有资料重新判断需求；有结果会马上在这里回复。";
  const inserted = await admin.from("uat_clarification_messages").insert({
    task_id: taskId,
    sender_role: "ai_designer",
    message_type: "summary",
    content,
    client_request_id: ackRequestId,
    metadata: { status: "processing" },
  }).select("id").single();
  if (inserted.error) throw inserted.error;
  await mirrorFormalAiMessage(admin, { id: inserted.data.id, taskId, senderRole: "ai_designer", content });
  return inserted.data;
}

export async function saveRequesterAnswers(admin: any, taskId: string, answersInput: unknown, message: string, clientRequestId: string, userId: string) {
  const answers = normalizeAnswers(answersInput);
  const formalContents = buildFormalRequesterMessageContents(answers, message);
  if (!clientRequestId.trim()) throw new Error("CLIENT_REQUEST_ID_REQUIRED");
  const existing = (await admin.from("uat_clarification_messages").select("id").eq("task_id", taskId).eq("client_request_id", clientRequestId).maybeSingle()).data;
  if (existing) return existing;
  for (let index = 0; index < answers.length; index += 1) {
    const answer = answers[index];
    const row = (await admin.from("uat_clarifications").select("id,question,status").eq("id", answer.clarification_id).eq("task_id", taskId).eq("status", "open").single()).data;
    if (!row) throw new Error("OPEN_CLARIFICATION_NOT_FOUND");
    await admin.from("uat_clarifications").update({ answer: answer.answer, status: "answered", answered_by: userId, answered_at: new Date().toISOString() }).eq("id", row.id);
    const formalQuestion = await admin.from("task_ai_messages").update({ status: "answered" }).eq("id", row.id);
    if (formalQuestion.error) throw formalQuestion.error;
    const answerMessage = await admin.from("uat_clarification_messages").insert({ task_id: taskId, clarification_id: row.id, sender_id: userId, sender_role: "requester", message_type: "answer", content: answer.answer, metadata: { question: row.question } }).select("id").single();
    if (answerMessage.error) throw answerMessage.error;
    await mirrorFormalAiMessage(admin, { id: answerMessage.data.id, taskId, senderRole: "requester", content: formalContents.answers[index] });
  }
  const content = message.trim() || answers.map((answer) => answer.answer).join("\n");
  const inserted = await admin.from("uat_clarification_messages").insert({ task_id: taskId, sender_id: userId, sender_role: "requester", message_type: "message", content, client_request_id: clientRequestId }).select("id").single();
  if (inserted.error) throw inserted.error;
  if (formalContents.supplemental) await mirrorFormalAiMessage(admin, { id: inserted.data.id, taskId, senderRole: "requester", content: formalContents.supplemental });
  return inserted.data;
}

export async function delegateSoftQuestions(admin: any, taskId: string, clientRequestId: string, userId: string) {
  const rows = (await admin.from("uat_clarifications").select("id,question_type,status").eq("task_id", taskId).eq("status", "open")).data || [];
  const soft = rows.filter((row: any) => canDelegateQuestion(row.question_type));
  if (soft.length === 0) throw new Error("NO_SOFT_CLARIFICATIONS_TO_DELEGATE");
  await admin.from("uat_clarifications").update({ status: "superseded", closed_reason: "delegated_to_ai", answered_by: userId, answered_at: new Date().toISOString(), answer: "交给 AI 根据历史模板和专业判断决定" }).in("id", soft.map((row: any) => row.id));
  const formalQuestions = await admin.from("task_ai_messages").update({ status: "superseded" }).in("id", soft.map((row: any) => row.id));
  if (formalQuestions.error) throw formalQuestions.error;
  const inserted = await admin.from("uat_clarification_messages").insert({ task_id: taskId, sender_id: userId, sender_role: "requester", message_type: "answer", content: "剩余软性设计问题交给 AI 决定", client_request_id: clientRequestId, metadata: { delegated_ids: soft.map((row: any) => row.id) } }).select("id").single();
  if (inserted.error) throw inserted.error;
  await mirrorFormalAiMessage(admin, { id: inserted.data.id, taskId, senderRole: "requester", content: "剩余软性设计问题交给 AI 决定" });
  return inserted.data;
}
