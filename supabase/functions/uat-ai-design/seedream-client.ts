export async function generateSeedreamFinal(prompt: string, fetcher: typeof fetch = fetch) {
  const apiBase = Deno.env.get("SEEDREAM_API_BASE") || "";
  const apiKey = Deno.env.get("SEEDREAM_API_KEY") || "";
  const model = Deno.env.get("SEEDREAM_MODEL") || "";
  if (!apiBase || !apiKey || !model) throw new Error("SEEDREAM_NOT_CONFIGURED");
  const response = await fetcher(apiBase, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1242x1660", response_format: "url" }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`SEEDREAM_HTTP_${response.status}`);
  const payload = await response.json();
  const imageUrl = payload?.data?.[0]?.url || payload?.result?.data?.[0]?.url || payload?.result?.image_url;
  if (!imageUrl) throw new Error("SEEDREAM_OUTPUT_MISSING");
  return { image_url: imageUrl, provider: "seedream", model, raw_id: payload?.id || payload?.request_id || null };
}
