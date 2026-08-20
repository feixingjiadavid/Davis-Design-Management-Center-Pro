export const MAX_SAFE_CONNECT_ATTEMPTS=3;
export function isSafeConnectFailure(message){
  const text=String(message||'');
  if(/SEEDREAM_HTTP_400:InvalidParameter:.*Timeout while downloading url=https?:\/\/[^\s]*supabase\.co\/storage\//i.test(text)) return true;
  if(!/ARK_CONNECT_FAILED:/i.test(text)) return false;
  if(/abort|signal timed out|deadline|operation timed out|response timeout/i.test(text)) return false;
  return /client error\s*\(Connect\)|tcp connect error|failed to connect|connection refused|network is unreachable|dns error|name resolution/i.test(text);
}
export function safeConnectRetry(attempt,nowMs=Date.now()){
  const n=Math.max(1,Number(attempt)||1);
  const delay=[30000,60000,120000][Math.min(n-1,2)];
  return {retry:n<MAX_SAFE_CONNECT_ATTEMPTS,next_attempt_at:new Date(nowMs+delay).toISOString(),delay_ms:delay};
}
