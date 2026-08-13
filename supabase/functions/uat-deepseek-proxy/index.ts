import { proxyDeepSeekRequirement } from "./proxy-service.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Content-Type": "application/json" };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return out({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const body = await request.json();
    const result = await proxyDeepSeekRequirement({
      prompt: String(body.prompt || ""),
      model: String(body.model || "deepseek-v4-flash"),
      jwt,
      apiKey: Deno.env.get("DEEPSEEK_API_KEY") || "",
    });
    return out({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DEEPSEEK_PROXY_FAILED";
    const status = message === "DEEPSEEK_PROXY_NOT_CONFIGURED" ? 503 : message.includes("FORBIDDEN") || message.includes("JWT") ? 403 : 400;
    return out({ ok: false, error: message }, status);
  }
});
