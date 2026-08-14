import type { SourceReadResult } from "./source-types.ts";
import { validateTencentDocsUrl } from "./source-validator.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function decodeTokenIdentity(token: string) {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) throw new Error("TOKEN_FORMAT_INVALID");
  const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
  const payload = JSON.parse(atob(padded));
  const clientId = String(payload.clt || "");
  const openId = String(payload.sub || "");
  if (!clientId || !openId) throw new Error("TOKEN_IDENTITY_MISSING");
  return { clientId, openId };
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extractDocumentText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractDocumentText);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const ownText = typeof record.text === "string" ? [record.text] : [];
  return ownText.concat(Object.entries(record)
    .filter(([key]) => key !== "text" && !["title", "id", "fileId", "url"].includes(key))
    .flatMap(([, child]) => extractDocumentText(child)));
}

function isOpenApiJwt(token: string) {
  return token.split(".").length === 3;
}

async function readThroughSkillMcp(fileId: string, token: string, fetcher: Fetcher): Promise<SourceReadResult> {
  const response = await fetcher("https://docs.qq.com/openapi/mcp", {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_content", arguments: { file_id: fileId } } }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 401) return { status: "authorization_required", errorCode: "TENCENT_TOKEN_INVALID_OR_EXPIRED", errorMessage: "腾讯文档 Skill Token 无效或已过期。" };
  if (response.status === 403) return { status: "permission_denied", errorCode: "TENCENT_DOCUMENT_PERMISSION_DENIED", errorMessage: "当前腾讯文档账号无权读取该文档。" };
  if (!response.ok || payload?.error) return { status: "failed", errorCode: "TENCENT_MCP_ERROR", errorMessage: `腾讯文档 Skill 读取失败：${payload?.error?.message || `HTTP ${response.status}`}` };
  let result = payload?.result?.structuredContent;
  if (!result) {
    const text = payload?.result?.content?.[0]?.text;
    if (typeof text === "string") {
      try { result = JSON.parse(text); } catch { result = { content: text }; }
    }
  }
  const content = typeof result === "string" ? result : typeof result?.content === "string" ? result.content : extractDocumentText(result).join("\n");
  if (!content.trim()) return { status: "failed", errorCode: "TENCENT_CONTENT_EMPTY", errorMessage: "腾讯文档 Skill 未返回正文。" };
  const plainText = content.trim();
  return {
    status: "ready",
    document: {
      title: typeof result?.title === "string" ? result.title : fileId,
      plainText,
      structuredBlocks: [{ type: "document_text", text: plainText, inferred: false }],
      imageObservations: [],
      contentSha256: await sha256(`${fileId}\n${plainText}`),
      counts: { characterCount: plainText.length, tableCount: 0, imageCount: 0, attachmentCount: 0 },
    },
  };
}

export async function readAuthorizedTencentDocument(input: string, token: string, fetcher: Fetcher = fetch): Promise<SourceReadResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return { status: "authorization_required", errorCode: "TENCENT_OFFICIAL_AUTH_REQUIRED", errorMessage: "需要配置腾讯文档官方 Token 后读取正文。" };
  const url = validateTencentDocsUrl(input);
  const fileId = url.pathname.split("/").filter(Boolean).at(-1) || "";
  try {
    if (!isOpenApiJwt(normalizedToken)) return await readThroughSkillMcp(fileId, normalizedToken, fetcher);
    const { clientId, openId } = decodeTokenIdentity(normalizedToken);
    const authHeaders = { "access-token": normalizedToken, "client-id": clientId, "open-id": openId };
    const readById = (id: string) => fetcher(`https://docs.qq.com/openapi/doc/v3/${encodeURIComponent(id)}`, { method: "GET", headers: authHeaders, signal: AbortSignal.timeout(20_000) });
    let resolvedFileId = fileId;
    let response = await readById(resolvedFileId);
    let payload = await response.json().catch(() => null);
    if (response.ok && /File status is not normal/i.test(String(payload?.msg || payload?.message || ""))) {
      const page = await fetcher(url.toString(), { method: "GET", signal: AbortSignal.timeout(12_000) });
      const html = await page.text();
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/&amp;/gi, "&").trim() || "";
      if (title) {
        const search = await fetcher(`https://docs.qq.com/openapi/drive/v2/search?searchName=${encodeURIComponent(title)}`, { method: "GET", headers: authHeaders, signal: AbortSignal.timeout(20_000) });
        const searchPayload = await search.json().catch(() => null);
        const list = Array.isArray(searchPayload?.data?.list) ? searchPayload.data.list : [];
        const match = list.find((item: Record<string, unknown>) => item.title === title) || list[0];
        const matchedId = match?.ID || match?.id || match?.fileID || match?.fileId;
        if (matchedId) {
          resolvedFileId = String(matchedId);
          response = await readById(resolvedFileId);
          payload = await response.json().catch(() => null);
        } else {
          return { status: "failed", errorCode: "TENCENT_FILE_RESOLUTION_FAILED", errorMessage: `腾讯文档已授权，但无法把分享链接映射到账号文件。搜索状态=${search.status}，结果数=${list.length}，标题=${title || "未识别"}` };
        }
      }
    }
    if (response.status === 401) return { status: "authorization_required", errorCode: "TENCENT_TOKEN_INVALID_OR_EXPIRED", errorMessage: `腾讯文档授权失败：${payload?.msg || "Token 无效或已过期"}` };
    if (response.status === 403) return { status: "permission_denied", errorCode: "TENCENT_DOCUMENT_PERMISSION_DENIED", errorMessage: `腾讯文档拒绝读取：${payload?.msg || "当前授权账号无权读取该文档"}` };
    const explicitFailure = typeof payload?.ret === "number" ? payload.ret !== 0 : typeof payload?.code === "number" ? payload.code !== 0 : false;
    if (!response.ok || explicitFailure) {
      const businessCode = payload?.ret ?? payload?.code;
      const message = payload?.msg || payload?.message || (businessCode !== undefined ? `业务错误码 ${businessCode}` : `HTTP ${response.status}`);
      return { status: "failed", errorCode: "TENCENT_OPENAPI_ERROR", errorMessage: `腾讯文档官方接口读取失败：${message}` };
    }
    const documentData = payload?.data ?? payload;
    const content = typeof documentData === "string" ? documentData : extractDocumentText(documentData).join("\n");
    if (typeof content !== "string" || !content.trim()) return { status: "failed", errorCode: "TENCENT_CONTENT_EMPTY", errorMessage: "腾讯文档官方接口未返回正文。" };
    const plainText = content.trim();
    return {
      status: "ready",
      document: {
        title: typeof documentData?.title === "string" ? documentData.title : resolvedFileId,
        plainText,
        structuredBlocks: [{ type: "document_text", text: plainText, inferred: false }],
        imageObservations: [],
        contentSha256: await sha256(`${resolvedFileId}\n${plainText}`),
        counts: { characterCount: plainText.length, tableCount: 0, imageCount: 0, attachmentCount: 0 },
      },
    };
  } catch {
    return { status: "failed", errorCode: "TENCENT_MCP_FETCH_FAILED", errorMessage: "腾讯文档官方接口网络读取失败，可稍后重试。" };
  }
}
