export const SEEDREAM_DEMO_PROXY_URL = "https://supffjeeouibhqdfqosk.supabase.co/functions/v1/uat-seedream-proxy";
export const SEEDREAM_DEMO_MODEL = "doubao-seedream-4-0-250828";

export type SeedreamImageInput = {
  file_name?: string;
  data_url: string;
  input_kind?: "style" | "asset";
  role?: string;
};

export type SeedreamDemoContext = {
  taskId: string;
  pageIndex: number;
  pageCount: number;
};

export async function generateSeedreamDemo(
  prompt: string,
  size: { width: number; height: number },
  inputs: SeedreamImageInput[],
  context: SeedreamDemoContext,
  userJwt: string,
  fetcher: typeof fetch = fetch,
) {
  if (!String(userJwt || "").trim()) throw new Error("UAT_JWT_REQUIRED");
  if (!String(prompt || "").trim()) throw new Error("SEEDREAM_PROMPT_REQUIRED");
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) throw new Error("SEEDREAM_SIZE_INVALID");

  const images = inputs
    .map((item) => String(item?.data_url || "").trim())
    .filter(Boolean)
    .slice(0, 10);

  const response = await fetcher(SEEDREAM_DEMO_PROXY_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userJwt}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      task_id: context.taskId,
      page_index: context.pageIndex,
      page_count: context.pageCount,
      width: size.width,
      height: size.height,
      prompt,
      images,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(String(payload?.error || `SEEDREAM_PROXY_HTTP_${response.status}`));
  }
  if (!payload?.image_url) throw new Error("SEEDREAM_OUTPUT_MISSING");
  if (payload?.dimension_match === false) throw new Error(`SEEDREAM_SIZE_MISMATCH:${payload?.actual_size || "unknown"}`);

  return {
    image_url: String(payload.image_url),
    provider: "seedream",
    model: String(payload.model || SEEDREAM_DEMO_MODEL),
    size: { width: size.width, height: size.height },
    requested_size: String(payload.requested_size || `${size.width}x${size.height}`),
    actual_size: String(payload.actual_size || `${size.width}x${size.height}`),
    dimension_match: payload.dimension_match !== false,
    input_image_count: Number(payload.input_image_count ?? images.length),
    drive_file_id: payload.drive_file_id || null,
    drive_url: payload.drive_url || null,
    drive_thumbnail_url: payload.drive_thumbnail_url || null,
    drive_folder_id: payload.drive_folder_id || null,
    drive_folder_url: payload.drive_folder_url || null,
    drive_file_name: payload.drive_file_name || null,
    usage: payload.usage || {},
  };
}

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
