const UAT_URL = "https://bjzfkwxrvytgphvgwltl.supabase.co";
const UAT_PUBLISHABLE_KEY = "sb_publishable__c7_KcaKy6NlBO0BKsmy2g_oGZmZSYV";
const ALLOWED_EMAILS = new Set([
  "uat.requester@webank.com",
  "davis.design.ai@webank.com",
  "uat.leader@webank.com",
  "uat.admin@webank.com",
]);

export interface ProxyInput {
  prompt: string;
  model: string;
  jwt: string;
  apiKey: string;
}

export async function proxyDeepSeekRequirement(input: ProxyInput, fetcher: typeof fetch = fetch) {
  if (!input.apiKey) throw new Error("DEEPSEEK_PROXY_NOT_CONFIGURED");
  if (!input.jwt) throw new Error("UAT_JWT_REQUIRED");
  const callerResponse = await fetcher(`${UAT_URL}/auth/v1/user`, {
    headers: { apikey: UAT_PUBLISHABLE_KEY, authorization: `Bearer ${input.jwt}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!callerResponse.ok) throw new Error("UAT_JWT_INVALID");
  const caller = await callerResponse.json();
  if (!ALLOWED_EMAILS.has(String(caller?.email || "").toLowerCase())) throw new Error("UAT_CALLER_FORBIDDEN");
  const response = await fetcher("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: input.model || "deepseek-v4-flash",
      temperature: 0.1,
      stream: false,
      messages: [
        { role: "system", content: "你是设计需求分析大脑。只输出一个有效 JSON 对象；事实必须有来源定位，缺失信息必须追问，禁止编造。" },
        { role: "user", content: input.prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  const payload = await response.json();
  const choice = payload?.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("DEEPSEEK_RESPONSE_TRUNCATED");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("DEEPSEEK_EMPTY_RESPONSE");
  return { content, usage: payload?.usage || {}, model: payload?.model || input.model };
}
