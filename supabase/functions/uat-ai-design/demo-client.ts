export async function generateCloudflareDemo(
  prompt: string,
  size: { width: number; height: number } = { width: 1242, height: 1660 },
  fetcher: typeof fetch = fetch,
) {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN") || "";
  const model = Deno.env.get("CLOUDFLARE_DEMO_MODEL") || "";
  if (!accountId || !apiToken || !model) throw new Error("CLOUDFLARE_DEMO_NOT_CONFIGURED");

  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      width: size.width,
      height: size.height,
      num_steps: 4,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) throw new Error(`CLOUDFLARE_DEMO_HTTP_${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { image_url: `data:${contentType};base64,${btoa(binary)}`, provider: "cloudflare", model, size };
  }
  const payload = await response.json();
  const base64 = payload?.result?.image || payload?.result;
  if (typeof base64 === "string") return { image_url: `data:image/png;base64,${base64}`, provider: "cloudflare", model, size };
  return { provider: "cloudflare", model, size, result: payload?.result || payload };
}
