export function shouldEnableAiChat(task) {
  return task?.assignee === 'davis.design.ai';
}

export function buildOptimisticMessage(content, clientRequestId) {
  return { id: clientRequestId, client_request_id: clientRequestId, sender_role: 'requester', message_type: 'message', content: String(content || '').trim(), pending: true, created_at: new Date().toISOString() };
}

export function renderMessageBubble(message, escapeHtml) {
  const mine = message.sender_role === 'requester';
  return `<div class="flex ${mine ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200'}"><p class="text-sm whitespace-pre-wrap">${escapeHtml(message.content)}</p>${message.pending ? '<p class="text-[10px] opacity-70 mt-1">发送中…</p>' : ''}</div></div>`;
}
