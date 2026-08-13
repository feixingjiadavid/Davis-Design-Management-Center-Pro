import { validateRequirementBrief } from "./requirement-schema.ts";

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
  proxyUrl?: string;
  userJwt?: string;
}

export async function callDeepSeekRequirementModel(
  prompt: string,
  config: DeepSeekConfig,
  fetcher: typeof fetch = fetch,
) {
  if (!config.model || (!config.apiKey && (!config.proxyUrl || !config.userJwt))) throw new Error("DEEPSEEK_MODEL_NOT_CONFIGURED");
  const usingProxy = !config.apiKey;
  const response = await fetcher(usingProxy ? config.proxyUrl! : "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${usingProxy ? config.userJwt : config.apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify(usingProxy ? { prompt, model: config.model } : {
      model: config.model,
      temperature: 0.1,
      stream: false,
      messages: [
        {
          role: "system",
          content: "你是设计需求分析大脑。只输出一个有效 JSON 对象，严格遵循用户提供的字段结构；事实必须带来源定位，缺失信息必须转成追问，不得编造。",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    if (usingProxy) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `DEEPSEEK_PROXY_HTTP_${response.status}`);
    }
    throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  }
  const payload = await response.json();
  const choice = usingProxy ? { message: { content: payload?.content }, finish_reason: "stop" } : payload?.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("DEEPSEEK_RESPONSE_TRUNCATED");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("DEEPSEEK_EMPTY_RESPONSE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("DEEPSEEK_INVALID_JSON");
  }
  return { brief: validateRequirementBrief(parsed), usage: payload?.usage || {} };
}
