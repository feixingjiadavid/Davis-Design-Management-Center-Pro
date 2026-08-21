export function toFormalAiMessage({ id, taskId, senderRole, content, status = 'sent' }) {
  const sender_type = senderRole === 'ai_designer' || senderRole === 'ai'
    ? 'ai'
    : (senderRole === 'requester' ? 'requester' : '');
  const message = String(content || '').trim();
  if (!String(id || '').trim() || !String(taskId || '').trim() || !sender_type || !message) return null;
  return {
    id: String(id),
    task_id: String(taskId),
    sender_type,
    content: message,
    status: String(status || 'sent'),
  };
}

export async function mirrorFormalAiMessage(admin, input) {
  const row = toFormalAiMessage(input);
  if (!row) return null;
  const result = await admin.from('task_ai_messages').upsert(row, { onConflict: 'id' }).select('id').single();
  if (result.error) throw result.error;
  return result.data;
}

export function buildFormalRequesterMessageContents(answers, message = '') {
  return {
    answers: (Array.isArray(answers) ? answers : []).map((item) => String(item?.answer || '').trim()).filter(Boolean),
    supplemental: String(message || '').trim(),
  };
}
