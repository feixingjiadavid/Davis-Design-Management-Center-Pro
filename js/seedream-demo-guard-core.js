export function shouldContinuePolling({ inflight, text }) {
  const value = String(text || '');
  if (!inflight) return false;
  if (/生成失败|已完成|待需求方确认/.test(value)) return false;
  return /请求已发出|等待 Seedream|页生成中|Demo 正在生成/.test(value);
}

export function healthResult(payload) {
  if (payload?.ok === true && payload?.network_reachable === true) {
    return { ok: true, status: Number(payload.status || 0) };
  }
  return { ok: false, error: String(payload?.error || 'ARK_NETWORK_UNREACHABLE') };
}
