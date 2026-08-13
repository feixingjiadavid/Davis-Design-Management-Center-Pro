const ALLOWED_HOSTS = new Set(["docs.qq.com"]);

function isIpLiteral(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

export function validateTencentDocsUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("INVALID_SOURCE_URL");
  }
  if (url.protocol !== "https:") throw new Error("SOURCE_HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("SOURCE_CREDENTIALS_FORBIDDEN");
  if (isIpLiteral(url.hostname)) throw new Error("SOURCE_IP_FORBIDDEN");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error("SOURCE_HOST_NOT_ALLOWED");
  if (!url.pathname.startsWith("/doc/")) throw new Error("SOURCE_PATH_UNSUPPORTED");
  url.hash = "";
  return url;
}
