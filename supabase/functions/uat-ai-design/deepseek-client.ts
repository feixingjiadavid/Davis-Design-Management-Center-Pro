import { validateRequirementBrief } from "./requirement-schema.ts";

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
}

export async function callDeepSeekRequirementModel(
  prompt: string,
  config: DeepSeekConfig,
  fetcher: typeof fetch = fetch,
) {
  if (!config.apiKey || !config.model) throw new Error("DEEPSEEK_MODEL_NOT_CONFIGURED");
  const response = await fetcher("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
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
  if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`);
  const payload = await response.json();
  const choice = payload?.choices?.[0];
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
