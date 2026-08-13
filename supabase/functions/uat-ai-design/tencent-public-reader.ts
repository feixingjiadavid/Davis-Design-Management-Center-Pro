import type { SourceReadResult } from "./source-types.ts";
import { validateTencentDocsUrl } from "./source-validator.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const LOGIN_MARKERS = ["微信扫码登录", "QQ登录", "登录后查看", "安全验证", "访问受限"];

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function textFromHtml(html: string) {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
  return decodeEntities(withoutNoise.replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readTencentPublic(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<SourceReadResult> {
  const url = validateTencentDocsUrl(input);
  let response: Response;
  try {
    response = await fetcher(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "Davis-AI-UAT-Document-Reader/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { status: "failed", errorCode: "SOURCE_FETCH_FAILED", errorMessage: "腾讯文档网络读取失败，可稍后重试。" };
  }
  if ([401, 403].includes(response.status)) {
    return { status: "authorization_required", errorCode: "TENCENT_AUTHORIZATION_REQUIRED", errorMessage: "该腾讯文档需要授权读取。" };
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    if (/login|auth|verify/i.test(location)) {
      return { status: "authorization_required", errorCode: "TENCENT_AUTHORIZATION_REQUIRED", errorMessage: "该腾讯文档需要微信或 QQ 授权。" };
    }
    return { status: "failed", errorCode: "UNSAFE_REDIRECT", errorMessage: "腾讯文档返回了未验证的跳转地址。" };
  }
  if (!response.ok) return { status: "failed", errorCode: "SOURCE_HTTP_ERROR", errorMessage: `腾讯文档读取失败（HTTP ${response.status}）。` };
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > 5_000_000) return { status: "failed", errorCode: "SOURCE_TOO_LARGE", errorMessage: "腾讯文档响应超过 5MB 限制。" };
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return { status: "unsupported", errorCode: "SOURCE_CONTENT_TYPE_UNSUPPORTED", errorMessage: "腾讯文档返回了暂不支持的内容类型。" };
  const html = await response.text();
  if (html.length > 5_000_000) return { status: "failed", errorCode: "SOURCE_TOO_LARGE", errorMessage: "腾讯文档响应超过 5MB 限制。" };
  const visibleText = textFromHtml(html);
  if (LOGIN_MARKERS.some((marker) => visibleText.includes(marker))) {
    return { status: "authorization_required", errorCode: "TENCENT_AUTHORIZATION_REQUIRED", errorMessage: "该腾讯文档需要微信或 QQ 授权。" };
  }
  if (visibleText.length < 20) {
    return { status: "unsupported", errorCode: "TENCENT_CONTENT_NOT_EXPOSED", errorMessage: "链接可以打开，但正文没有公开输出；请调整分享权限或上传 Word/PDF。" };
  }
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "腾讯文档");
  const tableCount = (html.match(/<table\b/gi) || []).length;
  const images = Array.from(html.matchAll(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi), (match) => ({ alt: decodeEntities(match[1].trim()), inferred: false }));
  const normalized = `${title}\n${visibleText}`;
  return {
    status: "ready",
    document: {
      title,
      plainText: visibleText,
      structuredBlocks: [{ type: "document_text", text: visibleText, inferred: false }],
      imageObservations: images,
      contentSha256: await sha256(normalized),
      counts: {
        characterCount: visibleText.length,
        tableCount,
        imageCount: images.length,
        attachmentCount: 0,
      },
    },
  };
}
