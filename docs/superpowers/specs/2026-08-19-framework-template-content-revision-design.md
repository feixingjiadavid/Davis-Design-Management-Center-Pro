# 已通过框架母版与后续内容改版流程设计

日期：2026-08-19

## 1. 目标与不可变原则

本设计把“框架方向”和“业务内容”彻底分开：

1. 第一阶段由 AI 生成框架 Demo，领导只负责审批设计框架方向。
2. 领导驳回后，任务必须先回需求方；AI 不得自动猜测修改并重新生图。
3. 需求方需要和领导沟通后，整理成明确的“本轮框架调整要求”，再由需求方主动触发下一轮框架生成。
4. 框架可以无限循环 `AI → 领导 → 需求方 → AI → 领导`，直到领导通过。
5. 领导一旦通过某一轮框架，该版本永久冻结为该需求唯一设计母版；需求方无权换风格、改框架或重新定义设计方向。
6. 领导通过后，如果内容无需调整，需求方可以直接验收当前 Demo 并完结，不能再次调用 Seedream。
7. 如果内容需要变化，需求方可以更新腾讯文档、在系统内填写新内容，或两者同时使用；AI 只能基于已通过母版做内容改版。
8. 后续内容改版不再经过领导审批，直接回需求方验收。
9. 内容检测、文档变化、状态变化都不能自动触发付费生成；只有用户明确点击生成按钮才允许创建 Seedream 请求。
10. 未变化页面必须复用，避免成本浪费和风格漂移。
11. 高清设计原图继续存 Google Drive；Supabase 保存结构化事实、版本关系和 Drive file id，不承担高清原图长期存储。

## 2. 正式任务状态流转

继续复用 `test_tasks.status`，不创建第二套任务生命周期。

### 2.1 框架阶段

```text
processing
  ↓
pending_approval
  ├─ 领导驳回 → rejected
  │                ↓
  │       需求方与领导沟通
  │                ↓
  │       填写本轮框架调整要求
  │                ↓
  │       需求方明确点击生成
  │                ↓
  │            processing
  │                ↓
  │          pending_approval
  │                └─ 不通过则继续循环
  │
  └─ 领导通过 → reviewing
```

硬规则：

- `reject_framework` 后 0 次 provider generation。
- `rejected` 阶段没有需求方调整要求时，AI 无权生成新框架。
- 领导意见可以很简短，它只作为输入之一；真正用于下一轮生成的执行要求来自需求方和领导沟通后提交的 `requester_direction`。
- 每轮框架版本 v1/v2/v3... 独立保留，不能覆盖旧版本。

### 2.2 母版通过后的验收与内容改版

```text
reviewing
  ├─ 无内容修改 → 需求方直接验收 → completed
  │                    （0 次 Seedream）
  │
  └─ 内容需要调整
        ↓
     更新腾讯文档 / 系统内填写内容
        ↓
     检测差异（0 次 Seedream）
        ↓
     需求方明确点击“提交内容更新并生成新版本”
        ↓
     processing
        ↓
     仅生成受影响页面
        ↓
     reviewing
        ├─ 满意 → completed
        └─ 继续改内容 → 重复本循环
```

母版通过后不再回 `pending_approval`，领导不再参与后续内容改版。

## 3. 角色权限

### 3.1 领导

仅拥有框架审批权：

- `approve_framework`
- `reject_framework`

领导不负责后续内容改版验收。

### 3.2 需求方

框架未通过时：

- 接收领导驳回；
- 与领导沟通；
- 填写本轮框架调整要求；
- 可同时刷新腾讯文档或补充系统文字；
- 主动点击后才允许触发下一轮生成。

框架已通过后：

- 无权修改母版；
- 可直接验收；
- 可更新业务内容；
- 可反复提交内容 revision，直到最终验收。

### 3.3 AI 设计师

框架阶段：根据原始需求、视觉参考、必用资产、上一轮被驳回框架、领导意见和需求方明确调整要求生成下一版框架。

母版阶段：始终把领导通过版本视为最高优先级视觉锚点，只做内容改版，不得重新设计风格。

## 4. 数据模型

新增三个“事实记录表”，但不新增第二套任务状态机。

### 4.1 `uat_framework_adjustments`

用途：结构化保存每一次领导驳回后，需求方整理出的下一轮可执行调整要求。

建议字段：

```text
id uuid pk
task_id text not null
based_on_framework_version text not null
leader_feedback text
requester_direction text not null
supplemental_content text
refresh_tencent_doc boolean default false
created_by uuid
created_at timestamptz
consumed_by_generation_run text / uuid
```

约束：

- `requester_direction` 必填。
- 一条 adjustment 只能被一个新框架 generation run 消费一次。
- adjustment 本身只代表用户输入，不是任务状态。

### 4.2 `uat_framework_templates`

用途：保存领导最终通过后的唯一正式设计母版。

建议字段：

```text
id uuid pk
task_id text not null unique
framework_version text not null
analysis_id uuid
approved_by uuid
approved_by_label text
approved_at timestamptz not null
approval_note text
page_count int not null
width int
height int
source_content_hash text
pages jsonb not null
created_at timestamptz
```

`pages` 示例：

```json
[
  {
    "page_index": 1,
    "page_title": "封面页",
    "generation_id": "...",
    "drive_file_id": "...",
    "drive_url": "...",
    "exact_copy": ["..."]
  }
]
```

约束：

- 一个 task 只能存在一个有效母版。
- 只允许服务端在 `approve_framework` 成功后创建。
- 需求方无更新/替换权限。
- 高清原图仍在 Google Drive。

### 4.3 `uat_content_revisions`

用途：保存母版锁定后的每一次业务内容修改请求和生成结果。

建议字段：

```text
id uuid pk
task_id text not null
template_id uuid not null
revision_no int not null
source_mode text not null
system_content text
previous_content_hash text
new_content_hash text
change_summary jsonb
affected_pages int[]
page_manifest jsonb
status text not null
created_by uuid
created_at timestamptz
submitted_at timestamptz
generated_at timestamptz
```

`source_mode`：`tencent_doc | system_text | combined`

`status`：`draft | content_ready | generation_requested | generating | ready_for_review | capacity_conflict | failed | accepted`

这些是 revision 记录自身状态，不替代 `test_tasks.status`。

## 5. history_json 正式动作

继续写入现有历史，保证管理台、时间线和统计兼容：

```text
submit_framework
reject_framework
framework_adjustment_submitted
approve_framework
content_revision_submitted
submit_draft
complete
```

### 5.1 领导驳回

`reject_framework` 只记录结果，不生成：

```json
{
  "action": "reject_framework",
  "version": "v-2",
  "reply": "领导意见",
  "operator": "领导",
  "is_rejected": true
}
```

### 5.2 需求方提交新方向

```json
{
  "action": "framework_adjustment_submitted",
  "adjustment_id": "...",
  "based_on_version": "v-2",
  "leader_feedback": "领导原始意见",
  "requester_direction": "与领导沟通后整理的明确执行要求",
  "operator": "需求方"
}
```

### 5.3 内容修订

```json
{
  "action": "content_revision_submitted",
  "revision_no": 2,
  "template_version": "v-3",
  "source_mode": "combined",
  "previous_content_hash": "...",
  "new_content_hash": "...",
  "affected_pages": [2]
}
```

## 6. 框架驳回后的需求方 UI

当 `task.status = rejected` 且最新正式动作是 `reject_framework`，详情页展示专用模块：

**标题：框架方案被领导驳回**

展示：

- 当前被驳回的框架版本及三页高清图；
- 领导原始意见；
- 提示“请先与领导沟通确认后，再整理下一轮调整方向”。

输入：

- 必填：`本轮框架调整要求`；
- 可选：重新读取腾讯文档；
- 可选：系统内补充文字。

按钮：

> 提交调整要求，重新生成框架

这是一个明确的付费生成授权按钮。一次点击的事务顺序必须是：

1. 写 `uat_framework_adjustments`；
2. 写 `framework_adjustment_submitted`；
3. 刷新需要读取的资料并生成新的需求理解；
4. 创建新框架 generation run；
5. task → `processing`；
6. 生成完成后形成新的 `submit_framework` 并进入 `pending_approval`。

按钮未点击前，0 次 generation。

## 7. 领导通过后的母版冻结

`approve_framework` 成功时必须在一个受控后端动作里完成：

1. 找到领导实际批准的最新 `submit_framework`；
2. 读取该版本 P1/P2/P3 generation ids 与 Drive file ids；
3. 创建 `uat_framework_templates`；
4. 保存当时的 page schema、exact_copy、尺寸和内容 hash；
5. task → `reviewing`；
6. history 写 `approve_framework`；
7. 不生成 final，不调用 Seedream。

这一步完成后，母版永久锁定。

## 8. 领导通过后的需求方 UI

右侧操作区提供两个业务方向。

### 8.1 `确认验收并完结`

- 当前已批准 Demo 直接作为最终交付；
- task → `completed`；
- history 写 `complete`；
- 0 次 Seedream；
- 0 个新 generation。

### 8.2 `内容需要调整`

展开内容更新模块。

#### 腾讯文档更新

按钮：`检测腾讯文档最新内容`

- 重新读取当前正式腾讯文档；
- 比较 snapshot `content_sha256`；
- 无变化：提示未检测到变化；
- 有变化：显示差异摘要；
- 检测本身 0 次 generation。

#### 系统内更新

输入框：`本轮需要调整的内容`

支持完整新文案或逐页修改说明。

#### 最终生成按钮

> 提交内容更新并生成新版本

只有该按钮允许创建 revision generation。

## 9. 页面结构与内容差异锁定

框架通过后不只锁“风格”，还锁**页面结构**：

- `page_count` 不变；
- P1/P2/P3 页序不变；
- 每页 `page_title / page_role` 不变；
- AI 不得因为新腾讯文档内容自行重新拆页、合页或交换页面职责。

新内容分析必须映射到母版既有 page schema。

差异判断分两层：

### 9.1 全局内容是否变化

- 腾讯文档：snapshot SHA256；
- 系统内文字：规范化后 SHA256；
- combined：腾讯文档快照 + 系统文字规范化合并后 hash。

### 9.2 哪些既有页面发生变化

用母版/当前 revision 的 `exact_copy` 与新内容在**固定 page schema** 下生成的 `exact_copy` 比较：

- 完全相同 → 页面复用；
- 内容变化 → 标记 affected；
- 页数变化、页面职责变化或无法映射 → `capacity_conflict`，不生成。

## 10. 页面级复用与版本 manifest

未变化页面必须直接引用已有 Drive 文件；变化页面才允许重新生成。

例：

```text
母版 P1 未变化 → 复用母版 P1
P2 内容变化     → 生成 revision P2
P3 未变化       → 复用母版 P3
```

`page_manifest` 记录当前完整版本每页来自哪里：

```json
[
  {"page_index":1,"source":"template","drive_file_id":"..."},
  {"page_index":2,"source":"revision","generation_id":"...","drive_file_id":"..."},
  {"page_index":3,"source":"template","drive_file_id":"..."}
]
```

如果某页在 r1 已经改过、r2 未再变化，则 r2 可以复用 r1 的该页文件；但**视觉锚点权威仍永远是 approved template**，不能把 r1 取代母版成为新设计模板。

## 11. 母版锁定生成策略

新增专用 prompt/version：

`seedream-template-revision-v1`

不能复用第一轮 Creative Director Prompt。

后续 revision Prompt 必须明确：

> 当前提供的领导已通过页面是不可变视觉母版，不是普通风格参考。禁止重新设计视觉风格、整体构图体系、背景体系、主色体系、字体气质、装饰语言、IP/Logo规则、页面职责和信息层级。只允许为本轮新业务内容做必要的文字、字号、行距、局部间距和局部元素位置调整。不得把任务理解为重新设计一套方案。

每个 affected page 的输入优先级：

1. 对应的 approved template page 高清图；
2. 本页最新正式文案与差异说明；
3. 必用业务素材；
4. Logo/IP 原始资产；
5. 其他外部 style reference（如果仍需使用，优先级低于母版）。

多轮 revision 始终回锚 approved template，防止累计漂移。

## 12. 内容容量冲突

以下情况进入 `capacity_conflict`，0 次 Seedream：

- 页数需要变化；
- 新内容无法映射到原页面职责；
- 某页文字量明显超出母版合理容量；
- 新增信息结构要求实质改变原框架。

需求方看到：

> 最新内容超出已通过设计框架的合理承载范围。框架已经由领导确认，系统不会擅自改变设计方向。请精简、拆分或重新组织内容后再次提交。

系统不能为解决容量问题自动换框架。

## 13. 生成授权与计费安全

0 次 provider generation 的动作：

- 领导 `reject_framework`；
- 检测腾讯文档更新；
- 保存系统内文字；
- 计算 hash/diff；
- 创建 revision draft；
- capacity conflict；
- 需求方直接验收；
- 页面复用。

允许创建付费生成的用户动作只有：

1. `提交调整要求，重新生成框架`
2. `提交内容更新并生成新版本`

其他规则：

- 每个生成请求必须使用 idempotency key；
- provider 是否已接受请求不明确时禁止自动付费重试；
- 已有可复用页面不得重复生成；
- 检测到内容变化不能自动生图。

## 14. Google Drive 存储

建议目录：

```text
TK-0001/
  framework/
    v1/P1.jpg P2.jpg P3.jpg
    v2/...
  approved-template/
    P1.jpg P2.jpg P3.jpg
  revisions/
    r1/...
    r2/...
```

数据库保存 Drive file ids 和版本映射。未变化页面可以只在 manifest 中引用已有 Drive 文件，不重复上传。

## 15. 历史版本展示

历史版本库区分：

- 框架版本 v1/v2/v3；
- 当前领导批准母版；
- 内容 revision r1/r2/r3。

领导框架审核：继续使用三页 Google Drive 原始高清图，默认三页完整同屏，单页适屏，主动 1:1 才滚动看细节。

需求方内容验收：展示当前完整 `page_manifest` 组成的 P1/P2/P3，用户无需关心某页是母版复用还是新 generation。

## 16. API / Action 设计

在现有 UAT AI 后端增加明确动作，不把生图隐藏在状态变化里。

### 16.1 `generate_framework_revision`

由“提交调整要求，重新生成框架”按钮调用。

输入：

```json
{
  "task_id": "TK-0001",
  "requester_direction": "...",
  "refresh_tencent_doc": true,
  "supplemental_content": "...",
  "idempotency_key": "..."
}
```

后端先持久化 adjustment，再生成。没有 `requester_direction` 必须拒绝。

### 16.2 `check_content_update`

只刷新 sources/snapshots、返回 hash 和差异摘要，0 次生图。

### 16.3 `prepare_content_revision`

保存系统内文字、建立 revision、固定 page schema 下计算 diff / affected pages / capacity，0 次生图。

### 16.4 `generate_content_revision`

输入必须包含 `revision_id + idempotency_key`。仅生成 affected pages，使用 approved template pages 强参考。全部页面 manifest 完整后 task → `reviewing`。

### 16.5 `accept_current_revision`

直接完成任务，0 次生图。

## 17. RLS / 权限门禁

- `uat_framework_templates`：需求方和领导可读；只有受控服务端可以创建；需求方不可 update/delete。
- `uat_framework_adjustments`：只有任务需求方可创建自己任务的记录；AI/服务端可读并消费；领导可读。
- `uat_content_revisions`：只有任务需求方可创建 revision；生成状态和 generation 绑定由服务端更新。
- `generate_framework_revision` 必须验证当前 task 为 `rejected` 且最新正式动作为 `reject_framework`。
- `generate_content_revision` 必须验证母版已经存在且 task 属于母版通过后的 revision 流程。
- 母版通过后任何接口都不能让需求方回到 framework generation。

## 18. 现有系统兼容与必须移除的旧行为

复用：

- `test_tasks.status`
- `history_json`
- `uat_requirement_sources`
- `uat_source_snapshots`
- `uat_requirement_analyses`
- `uat_design_generations`
- Google Drive archive/preview relay
- 现有 `pending_approval` 领导审批 UI
- 现有 `reviewing → completed` 需求方验收闭环

必须禁用或重构：

- `confirm_understanding` 自动触发 Demo 的旧行为；
- `executeAnalysis()` 理解完成后自动 `runDemoGeneration()` 的旧行为；
- 领导通过后自动生成 final 的旧路径；
- 任何由 `processing` 单一状态驱动的整页轮询；
- 任何检测到 source stale 后自动调用 Seedream 的行为。

## 19. 错误处理

### 腾讯文档读取失败

保留上一快照，提示错误，不认为内容已更新，不生成。

### 内容没有变化

不创建 generation，提示可以直接验收当前版本。

### generation 失败

- revision 标记 failed；
- 不破坏上一版可验收结果；
- 不自动付费重试；
- 用户主动重试时创建新的 idempotency key 并保留失败记录。

### 部分页面成功

保存成功页面，但在完整 page manifest 形成前 task 不进入 `reviewing`。

## 20. TK-0001 迁移

当前 TK-0001 已有领导批准的框架 v-1、P1/P2/P3 Drive file ids、v9 confirmed analysis。

迁移必须：

1. 从现有 `submit_framework v-1 + approve_framework` 建立 `uat_framework_templates`；
2. 绑定现有三个 ready generation 为母版 pages；
3. 0 次 Seedream；
4. task 从当前 `processing` 修正为 `reviewing`；
5. 需求方立即看到 `确认验收并完结` 与 `内容需要调整`；
6. 不重复找领导审批。

## 21. 测试要求

必须覆盖：

### 框架循环

- 领导驳回后 0 次生成；
- 没有 requester_direction 不能生成；
- 明确点击后只创建一轮框架 generation；
- 新框架再次进入 pending_approval；
- 可多轮重复直到领导通过。

### 母版

- 一个 task 只有一个有效 template；
- template 指向领导实际批准版本；
- 需求方无法修改 template；
- 领导通过后直接 task → reviewing 且 0 次 final generation。

### 内容差异

- hash 无变化 → 0 次生成；
- P2 单页变化 → 只生成 P2；
- P1/P3 Drive id 复用；
- page_count/page_role 变化 → capacity_conflict；
- tencent_doc/system_text/combined 三种 source mode。

### Prompt / 模型输入

- revision prompt 不含“重新建立视觉概念”等第一轮创作指令；
- affected page 的第一视觉锚点是 approved template page；
- Logo/IP 原始资产继续传入；
- template 优先级高于外部 style reference。

### 计费安全

以下动作断言 provider POST = 0：

- reject_framework
- check_content_update
- prepare_content_revision
- accept_current_revision
- capacity_conflict

provider 状态不确定时断言无自动付费重试。

## 22. 最终验收标准

1. 框架不过时严格循环 `AI → 领导 → 需求方 → AI → 领导`。
2. 领导驳回后 AI 不会自行重画。
3. 需求方必须提交和领导沟通后的明确调整要求才能产生下一版框架。
4. 框架一旦通过就永久锁定为唯一母版，需求方无权改变设计方向。
5. 内容没变时可以直接验收已通过 Demo，完全不生图。
6. 内容变化支持腾讯文档和系统内文字两种来源。
7. 内容检测不自动生图；只有需求方明确点击生成按钮才调用 Seedream。
8. 后续每轮都强制回锚母版，页面职责、页数、整体视觉方向不漂移。
9. 未变化页面复用，只生成受影响页面。
10. 内容超出框架容量时要求需求方调整内容，AI 不得偷换框架。
11. 后续内容修改不再经过领导，直接给需求方验收。
12. 高清原图继续在 Google Drive，Supabase 只保存结构化事实和引用。
13. 全流程可追溯：框架版本、领导意见、需求方调整要求、母版、内容 revision、generation 和最终验收均有明确关联。
