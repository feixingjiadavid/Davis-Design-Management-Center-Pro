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

export function inferAnswerControl(question) {
  const text = String(question || '');
  const questionCount = (text.match(/[？?]/g) || []).length;
  if (questionCount > 1 || /(还是|分别)/.test(text)) return 'textarea';
  if (/(日期|哪一天|几月几日|时间)/.test(text)) return 'date';
  if (/(几张|多少张|数量|几个|多少个)/.test(text)) return 'number';
  if (/(是否|需不需要|要不要|可否|能否)/.test(text)) return 'choice';
  if (/(链接|网址|URL)/i.test(text)) return 'url';
  if (/(标题|名称|姓名|联系人)/.test(text) && !/(详细|说明|描述|原因)/.test(text)) return 'text';
  return 'textarea';
}

export function renderQuestionControl(question, index, escapeHtml) {
  const id = escapeHtml(question.id);
  const prompt = escapeHtml(question.question);
  const type = inferAnswerControl(question.question);
  const base = 'mt-3 w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-white outline-none focus:border-amber-400';
  let control = '';
  if (type === 'choice') {
    const options = ['是', '否', '部分需要', '交给AI决定'];
    const buttons = options.map((value) => `<button type="button" data-ai-choice-value="${value}" onclick="window.selectAiChoice(this)" class="px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:border-indigo-400/60 hover:bg-indigo-500/10 transition-all">${value === '交给AI决定' ? '不确定，交给 AI 决定' : value}</button>`).join('');
    control = `<input data-ai-question="${id}" type="hidden" value=""><div class="mt-3 flex flex-wrap gap-2" data-ai-choice-group>${buttons}</div>`;
  } else if (type === 'number') {
    control = `<input data-ai-question="${id}" type="number" min="0" step="1" class="${base}" placeholder="请输入数量">`;
  } else if (type === 'date') {
    control = `<input data-ai-question="${id}" type="date" class="${base}">`;
  } else if (type === 'url') {
    control = `<input data-ai-question="${id}" type="url" class="${base}" placeholder="https://">`;
  } else if (type === 'text') {
    control = `<input data-ai-question="${id}" type="text" class="${base}" placeholder="请输入明确答案">`;
  } else {
    control = `<textarea data-ai-question="${id}" class="${base} min-h-[88px]" placeholder="请输入答案；不确定可填写“交给AI决定”"></textarea>`;
  }
  return `<label class="block bg-amber-500/5 border border-amber-500/20 rounded-xl p-4"><span class="text-amber-200 text-sm">${index + 1}. ${prompt}</span>${control}</label>`;
}
