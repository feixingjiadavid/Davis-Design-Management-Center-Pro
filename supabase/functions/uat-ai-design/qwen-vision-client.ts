export type VisualReferenceRow = {
  id: string;
  file_name: string;
  data_url: string;
  note: string;
  is_primary: boolean;
  sort_order: number;
  updated_at?: string;
};

export function buildReferenceSignature(references: VisualReferenceRow[]) {
  return [...references]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((item) => [item.id, item.updated_at || "", item.is_primary ? "1" : "0", item.sort_order].join(":"))
    .join("|");
}

export async function analyzeVisualReferenceSet(
  admin: any,
  taskId: string,
  userJwt: string,
  fetcher: typeof fetch = fetch,
) {
  const result = await admin.from("uat_visual_references")
    .select("id,file_name,data_url,note,is_primary,sort_order,updated_at")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (result.error) throw result.error;
  const references = (result.data || []) as VisualReferenceRow[];
  if (!references.length) return null;

  const signature = buildReferenceSignature(references);
  const cached = (await admin.from("uat_visual_reference_analyses")
    .select("*")
    .eq("task_id", taskId)
    .eq("reference_signature", signature)
    .maybeSingle()).data;
  if (cached) return { model: cached.model, analysis: cached.analysis, referenceIds: cached.reference_ids, cached: true };

  const response = await fetcher("https://supffjeeouibhqdfqosk.supabase.co/functions/v1/uat-qwen-vision-proxy", {
    method: "POST",
    headers: { authorization: `Bearer ${userJwt}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(100_000),
    body: JSON.stringify({
      images: references.map((item) => ({
        image_url: item.data_url,
        file_name: item.file_name,
        note: item.note,
        is_primary: item.is_primary,
      })),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.analysis) {
    throw new Error(payload?.error || `QWEN_VISION_PROXY_HTTP_${response.status}`);
  }

  const inserted = await admin.from("uat_visual_reference_analyses").insert({
    task_id: taskId,
    reference_signature: signature,
    reference_ids: references.map((item) => item.id),
    model: String(payload.model || "qwen-vl-plus"),
    analysis: payload.analysis,
  }).select("*").single();
  if (inserted.error) {
    const raced = (await admin.from("uat_visual_reference_analyses")
      .select("*")
      .eq("task_id", taskId)
      .eq("reference_signature", signature)
      .maybeSingle()).data;
    if (raced) return { model: raced.model, analysis: raced.analysis, referenceIds: raced.reference_ids, cached: true };
    throw inserted.error;
  }
  return { model: inserted.data.model, analysis: inserted.data.analysis, referenceIds: inserted.data.reference_ids, cached: false };
}
