# DeepSeek 需求理解大脑接入设计

## 目标

将 UAT 中“读取资料后的需求理解”从 Cloudflare 模型切换为 DeepSeek。DeepSeek 只负责结构化理解、追问、版式建议和模板匹配；Cloudflare Workers AI 继续负责低成本 Demo，Seedream 4.0 继续负责确认后的成品生成。

## 模型与接口

- 默认模型：`deepseek-v4-flash`
- 接口：`POST https://api.deepseek.com/chat/completions`
- 输出模式：`response_format: { "type": "json_object" }`
- 服务端密钥：Supabase Secret `DEEPSEEK_API_KEY`
- 可配置模型：Supabase Secret `DEEPSEEK_REQUIREMENT_MODEL`，未设置时使用 `deepseek-v4-flash`
- 密钥不得写入前端、数据库业务表、GitHub 或日志

## Supabase 接入方式

- 复用现有 Supabase Edge Function `uat-ai-design`，不新建服务器。
- DeepSeek 是外部托管模型，由 Edge Function 通过 OpenAI 兼容 HTTP API 调用；Supabase 内置 AI Session 当前不直接托管 DeepSeek。
- `DEEPSEEK_API_KEY` 与模型配置保存在 Supabase Edge Function Secrets，通过 `Deno.env.get` 读取。
- 现有 Supabase Auth JWT、UAT 白名单、RLS 与 service-role 后端写入边界保持不变。
- 实际密钥保留在正式项目，由 `uat-deepseek-proxy` 代理调用；代理不访问正式业务数据。
- 代理使用 UAT Auth `/auth/v1/user` 回验调用者 JWT，并只允许四个 UAT 白名单账号。
- UAT 项目只接收 DeepSeek 结构化输出，不复制或读取正式项目密钥。

## 数据流

1. Edge Function 读取需求单字段与已成功抓取的腾讯文档快照。
2. 组合历史已回答追问、设计模板与来源定位，生成既有需求分析提示词。
3. 调用 DeepSeek JSON Output。
4. 复用现有 `validateRequirementBrief` 做严格结构校验和事实引用校验。
5. 保存模型名、结构化理解单、置信度、用量及快照 ID。
6. 有缺失或冲突时创建追问；无缺失时进入需求方确认门禁。

## 失败与安全策略

- 未配置密钥：返回 `DEEPSEEK_MODEL_NOT_CONFIGURED`，不得生成固定内容或假理解。
- HTTP 异常：返回 `DEEPSEEK_HTTP_<status>`。
- 空输出、截断或非法 JSON：分析失败并允许人工重试，不自动循环扣费。
- 模型输出仍必须通过本地 Schema 校验；没有来源定位的事实不能入库。
- 用户数据只从 UAT 数据库读取，不访问正式环境。

## 前端表现

- AI 工作台明确显示“需求理解大脑：DeepSeek”。
- 没有有效分析记录时，不点亮“理解并追问”步骤。
- 配置缺失时显示可操作的配置错误，不能显示“AI 已理解”。

## 验证标准

- 单元测试证明请求使用 DeepSeek Bearer Token、JSON Output 和指定模型。
- 单元测试证明缺密钥、HTTP 异常、非法 JSON 会失败。
- 现有结构校验、追问、Demo/成品门禁测试全部继续通过。
- UAT Edge Function 部署后为 ACTIVE，GitHub Pages 构建成功。
- 配置真实 `DEEPSEEK_API_KEY` 后，用 `TK-0001` 完成一次资料读取和结构化分析，数据库出现可溯源分析记录。
