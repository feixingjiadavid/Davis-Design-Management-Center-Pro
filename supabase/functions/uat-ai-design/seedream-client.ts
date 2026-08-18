export const SEEDREAM_DEMO_PROXY_URL = "https://bjzfkwxrvytgphvgwltl.supabase.co/functions/v1/uat-ark-gateway";
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

export function resolveSeedreamProviderSize(size: { width: number; height: number }) {
  const align = (value: number) => Math.ceil(Number(value) / 32) * 32;
  return { width: align(size.width), height: align(size.height) };
}

async function generateViaUatArkGateway(
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

  const providerSize = resolveSeedreamProviderSize(size);
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
      action: "seedream.generate",
      task_id: context.taskId,
      page_index: context.pageIndex,
      page_count: context.pageCount,
      width: providerSize.width,
      height: providerSize.height,
      prompt,
      images,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(String(payload?.error || `SEEDREAM_GATEWAY_HTTP_${response.status}`));
  }
  if (!payload?.image_url && !payload?.provider_url) throw new Error("SEEDREAM_OUTPUT_MISSING");

  return {
    image_url: String(payload.drive_thumbnail_url || payload.image_url || payload.provider_url || ""),
    provider_url: String(payload.provider_url || "") || null,
    storage_path: null,
    provider: "seedream",
    model: String(payload.model || SEEDREAM_DEMO_MODEL),
    size: { width: size.width, height: size.height },
    target_size: `${size.width}x${size.height}`,
    provider_size: String(payload.provider_requested_size || `${providerSize.width}x${providerSize.height}`),
    requested_size: String(payload.provider_requested_size || `${providerSize.width}x${providerSize.height}`),
    actual_size: String(payload.actual_size || ""),
    dimension_match: true,
    input_image_count: Number(payload.input_image_count ?? images.length),
    drive_file_id: payload.drive_file_id || null,
    drive_url: payload.drive_url || null,
    drive_thumbnail_url: payload.drive_thumbnail_url || null,
    drive_folder_id: payload.drive_folder_id || null,
    drive_folder_url: payload.drive_folder_url || null,
    drive_file_name: payload.drive_file_name || null,
    drive_archive_status: String(payload.drive_archive_status || (payload.drive_file_id ? "completed" : "failed")),
    drive_error: payload.drive_error || null,
    persistent_storage: payload.drive_file_id ? "google_drive" : "provider_temporary",
    usage: payload.usage || {},
  };
}

export async function generateSeedreamDemo(
  prompt: string,
  size: { width: number; height: number },
  inputs: SeedreamImageInput[],
  context: SeedreamDemoContext,
  userJwt: string,
  fetcher: typeof fetch = fetch,
) {
  return await generateViaUatArkGateway(prompt, size, inputs, context, userJwt, fetcher);
}

export async function generateSeedreamFinal(
  prompt: string,
  size: { width: number; height: number },
  inputs: SeedreamImageInput[],
  context: SeedreamDemoContext,
  userJwt: string,
  fetcher: typeof fetch = fetch,
) {
  return await generateViaUatArkGateway(prompt, size, inputs, context, userJwt, fetcher);
}
