import { REQUIREMENT_BRIEF_JSON_SCHEMA, validateRequirementBrief } from "./requirement-schema.ts";

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  model: string;
  gatewayId?: string;
}

export async function callCloudflareRequirementModel(
  prompt: string,
  config: CloudflareConfig,
  fetcher: typeof fetch = fetch,
) {
  if (!config.accountId || !config.apiToken || !config.model) throw new Error("CLOUDFLARE_MODEL_NOT_CONFIGURED");
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
      ...(config.gatewayId ? { "cf-aig-gateway-id": config.gatewayId } : {}),
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "输出严格符合 JSON Schema 的中文设计需求理解单。" },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "requirement_brief", strict: true, schema: REQUIREMENT_BRIEF_JSON_SCHEMA },
      },
    }),
  });
  if (!response.ok) throw new Error(`CLOUDFLARE_HTTP_${response.status}`);
  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  const parsed = message?.parsed ?? (typeof message?.content === "string" ? JSON.parse(message.content) : message?.content);
  return { brief: validateRequirementBrief(parsed), usage: payload?.usage || {} };
}
