import type { SourceReadResult } from "./source-types.ts";

export interface TencentOfficialCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
}

export async function readAuthorizedTencentDocument(
  _url: string,
  credentials: TencentOfficialCredentials,
): Promise<SourceReadResult> {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.accessToken) {
    return {
      status: "authorization_required",
      errorCode: "TENCENT_OFFICIAL_AUTH_REQUIRED",
      errorMessage: "需要腾讯文档官方内容授权；当前可改为链接可查看或上传 Word/PDF。",
    };
  }
  return {
    status: "unsupported",
    errorCode: "TENCENT_CONTENT_API_NOT_CONFIGURED",
    errorMessage: "已具备授权凭证，但尚未配置腾讯官方文档内容接口。",
  };
}
