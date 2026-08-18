export function shouldContinuePolling({ inflight, text }) {
  const value = String(text || '');
  if (!inflight) return false;
  if (/生成失败|已完成|待需求方确认/.test(value)) return false;
  return /请求已发出|等待 Seedream|页生成中|Demo 正在生成/.test(value);
}

export function healthResult(payload) {
  const seedream = payload?.seedream || {};
  if (payload?.ark_key_present === false) {
    return { ok: false, error: 'ARK_API_KEY_MISSING' };
  }
  if (payload?.ok === true && seedream?.reachable === true) {
    return { ok: true, status: Number(seedream.status || 0) };
  }
  const detail = String(seedream?.error || payload?.error || 'ARK_NETWORK_UNREACHABLE');
  return { ok: false, error: detail };
}
