import assert from "node:assert/strict";
import test from "node:test";
import { validateTencentDocsUrl } from "./source-validator.ts";
import { readTencentPublic } from "./tencent-public-reader.ts";
import { readAuthorizedTencentDocument } from "./tencent-oauth-adapter.ts";
import { buildFormSourceDocument } from "./source-service.ts";

test("rejects non-HTTPS and non-Tencent hosts", () => {
  for (const url of [
    "http://docs.qq.com/doc/x",
    "https://127.0.0.1/x",
    "https://evil.example/x",
  ]) {
    assert.throws(() => validateTencentDocsUrl(url));
  }
});

test("accepts Tencent Docs document links", () => {
  const url = validateTencentDocsUrl("https://docs.qq.com/doc/DQm9zY2dVYmtkYWxn");
  assert.equal(url.hostname, "docs.qq.com");
  assert.equal(url.protocol, "https:");
});

test("does not treat a login page as document content", async () => {
  const result = await readTencentPublic(
    "https://docs.qq.com/doc/private",
    async () => new Response('<html><title>腾讯文档</title><body>微信扫码登录 QQ登录</body></html>', {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
  assert.equal(result.status, "authorization_required");
});

test("does not treat the Tencent editor shell as document content", async () => {
  const html = `<!doctype html><html><head><title>2026-TIG合作社-宣传文案</title></head><body>
    <div>个人 只能查看 登录腾讯文档 菜单 菜单 插入 插入 正文 正文 默认字体 默认字体
    四号 四号 快捷工具 PDF转换 生成图片 排版美化 打印
    __WEBLAYOUT_STATUSBAR_ICON_PLACEHOLDER__ 100% 正在同步内容...</div>
  </body></html>`;
  const result = await readTencentPublic(
    "https://docs.qq.com/doc/public-shell",
    async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
  );
  assert.equal(result.status, "authorization_required");
  if (result.status === "ready") return;
  assert.equal(result.errorCode, "TENCENT_OFFICIAL_AUTH_REQUIRED");
});

test("extracts visible public document text and statistics", async () => {
  const html = `<!doctype html><html><head><title>2026 TIG 合作社</title></head><body>
    <main><h1>宣传页设计</h1><p>渠道：小蓝书</p><table><tr><td>尺寸</td><td>1242×1660</td></tr></table><img alt="活动主视觉"></main>
  </body></html>`;
  const result = await readTencentPublic(
    "https://docs.qq.com/doc/public",
    async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.match(result.document.plainText, /宣传页设计/);
  assert.match(result.document.plainText, /1242×1660/);
  assert.equal(result.document.counts.tableCount, 1);
  assert.equal(result.document.counts.imageCount, 1);
  assert.equal(result.document.contentSha256.length, 64);
});

test("private OAuth adapter never falls back to cookies", async () => {
  const result = await readAuthorizedTencentDocument(
    "https://docs.qq.com/doc/private",
    { clientId: "", clientSecret: "", accessToken: "" },
  );
  assert.equal(result.status, "authorization_required");
  assert.equal(result.errorCode, "TENCENT_OFFICIAL_AUTH_REQUIRED");
});

test("turns submitted form fields into a traceable source snapshot", async () => {
  const document = await buildFormSourceDocument({
    id: "TK-1001",
    title: "2026 TIG 合作社-平面设计",
    full_desc: "宣传页与规则介绍页，渠道为小蓝书，尺寸 1242×1660。",
    project: "荣誉体系-科技合作社",
    channels: ["小蓝书"],
    due_date: "2026-08-21",
  });
  assert.match(document.plainText, /1242×1660/);
  assert.match(document.plainText, /2026-08-21/);
  assert.equal(document.structuredBlocks[0].type, "form_fields");
  assert.equal(document.contentSha256.length, 64);
});
