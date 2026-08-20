function clean(value) { return String(value || '').trim(); }

export function buildRevisionInstruction({ originalFeedback = '', clarifications = [], messages = [] } = {}) {
  const parts = [];
  const original = clean(originalFeedback);
  if (original) parts.push(`【原始修改意见】\n${original}`);

  const qa = (clarifications || [])
    .map((item) => ({ question: clean(item?.question), answer: clean(item?.answer) }))
    .filter((item) => item.question || item.answer)
    .map((item) => `AI追问：${item.question || '未记录问题'}\n需求方回答：${item.answer || '未填写'}`);
  if (qa.length) parts.push(`【AI追问与需求方最终回答】\n${qa.join('\n\n')}`);

  const extras = (messages || []).map(clean).filter(Boolean);
  if (extras.length) parts.push(`【需求方最新补充】\n${extras.map((item) => `- ${item}`).join('\n')}`);

  parts.push('【执行优先级】\n后续回答与补充为最新指令；如与原始修改意见冲突，以后续回答与补充覆盖原始冲突项。');
  return parts.join('\n\n');
}