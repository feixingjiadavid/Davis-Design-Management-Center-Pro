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

function textField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeRequirementContent(content: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return content;
  if (!Array.isArray(parsed.required_assets)) return content;

  parsed.required_assets = parsed.required_assets.map((item: unknown) => {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object" || Array.isArray(item)) return String(item ?? "").trim();
    const record = item as Record<string, unknown>;
    const role = textField(record, ["asset_role", "role", "type", "name", "label"]);
    const fileName = textField(record, ["file_name", "filename", "file", "asset_name"]);
    const status = textField(record, ["status", "state"]);
    const note = textField(record, ["note", "description", "usage", "instruction"]);
    const provided = record.provided === true || /已提供|uploaded|provided/i.test(status);
    const prefix = provided ? "已提供" : (status || "必用素材");
    const identity = [role, fileName].filter(Boolean).join(" / ");
    return `${prefix}：${identity || note || "未命名素材"}${note && identity ? `（${note}）` : ""}`;
  }).filter((item: string) => item.length > 0);

  return JSON.stringify(parsed);
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
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: input.model || "deepseek-v4-flash",
      temperature: 0.1,
      stream: false,
      messages: [
        { role: "system", content: "你是设计需求分析大脑。只输出一个有效 JSON 对象；事实必须有来源定位，缺失信息必须追问，禁止编造。required_assets 必须输出字符串数组，不得输出对象。" },
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
  return { content: normalizeRequirementContent(content), usage: payload?.usage || {}, model: payload?.model || input.model };
}
