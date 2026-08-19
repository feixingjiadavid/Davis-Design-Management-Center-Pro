# 已通过框架母版与后续内容改版流程设计

日期：2026-08-19

## 1. 目标

为 AI 设计流程建立一条稳定、可追溯且不会风格漂移的正式机制：

1. 第一阶段由 AI 生成框架 Demo，并由领导只负责审批设计框架方向。
2. 领导驳回框架后，不允许 AI 自动重生；任务必须回到需求方，由需求方与领导沟通并整理明确的本轮框架调整要求，再触发新一轮框架生成。
3. 框架一旦被领导通过，当前通过版本永久冻结为该需求的唯一设计母版；需求方无权改变框架方向。
4. 领导通过后，如果内容无需变化，需求方可以直接验收当前 Demo 并完结任务，不能再次调用 Seedream。
5. 如果业务内容发生变化，需求方可以更新腾讯文档或在系统内直接提交新内容；AI 只允许基于已通过母版做内容改版，不得重新设计风格。
6. 后续内容改版不再经过领导审批，直接回到需求方验收。
7. 只有内容实际变化且需求方明确提交生成动作时，才允许产生新的付费生成请求；系统禁止自动付费重试和自动生图。
8. 能复用未变化页面时必须复用，避免无意义生成、成本浪费和视觉漂移。

## 2. 不做的事情

- 不增加第二套审批系统。
- 不允许需求方在框架通过后选择“换风格”“重新设计”“大改方向”。
- 不允许领导驳回后 AI 根据一句模糊意见自行猜测并自动生成下一版。
- 不允许后台检测到文档变化后自动调用 Seedream。
- 不允许后续内容修改以“上一轮修改版”为唯一视觉基准逐轮漂移；所有后续改版始终回锚领导批准的母版。
- 不允许 Supabase 作为高清设计原图长期存储；高清原图继续存 Google Drive，Supabase 仅保存结构化元数据和引用 ID。

## 3. 角色权限

### 3.1 领导

领导只拥有“框架方向”的审批权：

- 通过框架；
- 驳回框架并填写可选意见。

领导不负责后续内容改版验收。

### 3.2 需求方

框架未通过时：

- 领导驳回后接收任务；
- 与领导沟通；
- 填写“本轮框架调整要求”；
- 可以同步更新腾讯文档或补充系统内信息；
- 明确点击后才允许触发下一轮框架生成。

框架已通过后：

- 无权修改设计框架方向；
- 可以直接验收已通过 Demo；
- 可以更新业务内容并提交新一轮内容改版；
- 可以反复进行内容更新与验收，直到最终完成。

### 3.3 AI 设计师

框架阶段：

- 根据原始需求、视觉参考、必用资产和需求方本轮调整要求生成框架版本；
- 领导驳回后必须等待需求方提交明确调整要求，禁止自行生成下一版。

母版阶段：

- 把领导通过的框架版本视为不可变视觉母版；
- 后续只做内容改版；
- 必须以母版页面作为强视觉参考输入；
- 不得擅自改变设计方向。

## 4. 正式状态流转

继续复用 `test_tasks.status` 现有正式状态，不创建第二套生命周期状态机。

### 4.1 框架阶段

```text
processing
  ↓
pending_approval
  ├─ 领导驳回 → rejected
  │                ↓
  │          需求方沟通并填写调整要求
  │                ↓
  │          明确提交新一轮生成
  │                ↓
  │            processing
  │                ↓
  │          pending_approval
  │                └─ 可无限循环
  │
  └─ 领导通过 → reviewing
```

关键规则：

- `reject_framework` 后禁止自动生图。
- `rejected` 阶段必须由需求方提交新的“框架调整要求”后才能回到 `processing`。
- 每一轮框架版本都独立保留，不能覆盖旧版本。

### 4.2 母版通过后的验收与内容修改

```text
reviewing
  ├─ 内容无需修改 → 需求方确认验收 → completed
  │                       （不调用 Seedream）
  │
  └─ 内容需要调整
        ↓
     需求方更新腾讯文档 / 系统内填写新内容
        ↓
     系统检测内容差异
        ↓
     需求方明确点击“提交内容更新并生成新版本”
        ↓
     processing
        ↓
     AI 基于已通过母版生成受影响页面
        ↓
     reviewing
        ├─ 满意 → completed
        └─ 继续改内容 → 重复本循环
```

领导在母版通过后不再进入该循环。

## 5. 数据模型

### 5.1 `uat_framework_templates`

用途：保存领导通过后的唯一正式设计母版。

建议字段：

```text
id uuid pk
task_id text not null unique
framework_version text not null
analysis_id uuid
approved_by uuid / text
approved_at timestamptz
approval_note text
page_count int not null
width int
height int
source_content_hash text
created_at timestamptz
```

母版页面明细建议使用 JSONB 或独立页表。优先使用 JSONB `pages`，结构如下：

```json
[
  {
    "page_index": 1,
    "generation_id": "...",
    "drive_file_id": "...",
    "drive_url": "...",
    "exact_copy": ["..."],
    "page_title": "..."
  }
]
```

约束：

- 一个 task 只能存在一个“当前有效母版”。
- 母版建立后不允许需求方修改或替换。
- 只有框架未通过阶段允许产生新的框架版本；领导最终通过的那一版成为唯一母版。
- 高清图片存 Google Drive，表中只保存 Drive file id / URL / generation id。

### 5.2 `uat_content_revisions`

用途：保存每一次母版锁定后的内容修改请求和生成结果。

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
status text not null
created_by uuid
created_at timestamptz
submitted_at timestamptz
generated_at timestamptz
```

`source_mode`：

- `tencent_doc`
- `system_text`
- `combined`

`status`：

- `draft`
- `content_ready`
- `generation_requested`
- `generating`
- `ready_for_review`
- `capacity_conflict`
- `failed`
- `accepted`

此状态是“内容修订记录自身状态”，不是任务生命周期状态，因此不会和 `test_tasks.status` 形成第二套审批流。

生成结果可通过 `uat_design_generations` 的 `parent_generation_id`、`revision_id` 或 output metadata 关联。

## 6. 历史记录 `history_json`

继续把用户和审批动作写进现有 `history_json`，保证管理台、时间线、统计逻辑继续工作。

正式动作：

```text
submit_framework
reject_framework
framework_adjustment_submitted
approve_framework
content_revision_submitted
submit_draft
complete
```

### 6.1 领导驳回

`reject_framework`：

```json
{
  "action": "reject_framework",
  "version": "v-2",
  "reply": "领导意见",
  "operator": "领导",
  "is_rejected": true
}
```

只记录意见和流程结果，不生成下一版。

### 6.2 需求方提交框架调整要求

`framework_adjustment_submitted`：

```json
{
  "action": "framework_adjustment_submitted",
  "based_on_version": "v-2",
  "leader_feedback": "领导原始意见",
  "requester_direction": "需求方与领导沟通后整理的可执行调整要求",
  "operator": "需求方"
}
```

该动作是下一轮框架生成的正式门禁。

### 6.3 内容修订

`content_revision_submitted`：

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

## 7. 框架驳回后的需求方 UI

任务状态 `rejected` 且最新动作是 `reject_framework` 时，需求方详情页显示专用卡片：

标题：

> 框架方案被领导驳回

内容：

- 展示领导原始意见；
- 提示需求方先与领导沟通确认方向；
- 必填输入框：`本轮框架调整要求`；
- 可选操作：重新读取腾讯文档；
- 可选操作：补充系统内文字说明；
- 最终按钮：`提交调整要求，重新生成框架`。

按钮点击前不能调用生成接口。

点击后：

1. 写 `framework_adjustment_submitted`；
2. 新建/更新需求理解版本；
3. task 状态改 `processing`；
4. 仅由这次用户明确点击触发一轮新的框架生成。

## 8. 领导通过后的需求方 UI

任务进入 `reviewing`。

右侧操作区提供两个且只有两个业务方向：

### 8.1 `确认验收并完结`

含义：

- 当前领导批准的 Demo 直接作为最终交付版本；
- 写 `complete`；
- task → `completed`；
- 不调用 Seedream；
- 不创建新的 generation。

### 8.2 `内容需要调整`

展开内容更新模块，支持两种输入方式同时存在。

#### 腾讯文档

按钮：`检测腾讯文档最新内容`

行为：

- 重新读取当前正式腾讯文档；
- 根据 `content_sha256` 判断是否出现新内容；
- 如果 hash 未变化，提示“未检测到内容变化”，不进入生成流程；
- 如果 hash 变化，显示差异摘要，但不自动生图。

#### 系统内更新

输入区域：

> 本轮需要调整的内容

支持直接粘贴完整新文案或逐页修改说明。

最终按钮：

> 提交内容更新并生成新版本

只有点击该按钮才创建 generation request。

## 9. 内容差异检测

复用现有 `uat_requirement_sources` + `uat_source_snapshots.content_sha256` 机制。

差异检测分两层：

### 9.1 是否变化

- 腾讯文档：使用新 snapshot SHA256 对比母版建立时或上一轮 revision 的 hash。
- 系统内文字：规范化后计算 SHA256。
- combined：将腾讯文档 snapshot + 系统内输入规范化合并后计算 revision hash。

### 9.2 哪些页面变化

不能只做全局 hash。还需要比较“每页正式文案”。

使用母版保存的 `pages[].exact_copy` 与新分析生成的每页 `copy` 做规范化比较：

- 完全相同 → 页面复用；
- 内容变化 → 标记为 `affected_pages`；
- 页面数量变化 → 进入容量/结构冲突检查，不允许直接改框架。

## 10. 页面级复用

母版或上一轮已验收待确认版本中，未变化页面必须直接复用已有 Drive 文件。

例如：

```text
P1 未变化 → 复用母版 P1
P2 变化   → 生成新 P2
P3 未变化 → 复用母版 P3
```

新的 revision 版本由“复用页面 + 新生成页面”组成。

目的：

- 降低生成成本；
- 减少等待时间；
- 最大程度避免风格随机漂移；
- 避免无意义付费调用。

## 11. 母版锁定生成策略

新增专用 prompt/version，例如：

`seedream-template-revision-v1`

不能复用第一轮用于创作新框架的 Creative Director Prompt，因为第一轮 Prompt 的职责是重新建立视觉概念、视觉中心和空间结构。

后续 revision Prompt 必须明确：

> 当前输入的领导已通过设计图是不可变视觉母版，不是普通风格参考。
>
> 禁止重新设计视觉风格、主题语言、整体构图体系、背景体系、色彩体系、字体气质、装饰语言、IP/Logo视觉规则和信息层级。
>
> 只允许根据本轮业务内容变化，对必要文字、字号、行距、局部间距和局部元素位置做最小调整。
>
> 除非新内容客观无法容纳，否则尽可能保持元素位置、尺寸比例、版面节奏、装饰、色彩、背景和视觉中心与母版一致。
>
> 不得把本轮任务理解为“重新设计一套方案”。

### 11.1 模型输入顺序

对每个受影响页面：

1. 该页领导批准母版高清图（强制视觉锚点）；
2. 该页必用业务素材；
3. Logo / IP 等原始资产；
4. 最新正式文案和差异说明。

母版图优先级高于原始外部风格参考图。

### 11.2 永远回锚母版

v2、v3、v4 内容修改时，视觉参考仍然以“领导批准母版”为最高优先级，而不是单纯使用上一轮修改图作为新模板，防止多轮累计漂移。

上一轮修改图可以作为内容位置参考，但不能替代母版的视觉权威。

## 12. 内容容量冲突

如果新内容明显超出已通过框架承载能力，系统不得擅自改变框架。

进入 `capacity_conflict`，不调用 Seedream。

需求方看到：

> 最新内容超出已通过设计框架的合理承载范围。框架已经由领导确认，系统不会擅自改变设计方向。请精简、拆分或重新组织内容后再次提交。

典型条件：

- 页面数量要求发生变化；
- 新内容长度远超该页母版容量；
- 新增结构块无法在原有层级内合理容纳；
- 原单页被要求承担完全不同的信息类型。

系统只能要求需求方调整内容，不能为解决容量问题自动换框架。

## 13. 生成授权与计费安全

所有付费生成遵守以下规则：

1. 领导驳回：不生成。
2. 需求方仅填写调整要求：不生成，直到点击明确生成按钮。
3. 检测腾讯文档更新：不生成。
4. 系统检测到内容 hash 变化：不生成。
5. 内容容量冲突：不生成。
6. 需求方直接验收：不生成。
7. 只有：
   - `提交调整要求，重新生成框架`
   - `提交内容更新并生成新版本`
   这两类明确用户动作允许创建付费生成请求。
8. Provider 状态不确定时禁止自动付费重试。
9. 已经有可复用页面时不重复生成。
10. 生成请求必须有 idempotency key。

## 14. Google Drive 存储

继续使用 Google Drive 作为高清设计原图长期存储。

建议目录：

```text
TK-0001/
  framework/
    v1/
      P1.jpg
      P2.jpg
      P3.jpg
    v2/
      ...
  approved-template/
    P1.jpg
    P2.jpg
    P3.jpg
  revisions/
    r1/
      P2.jpg
    r2/
      P1.jpg
      P3.jpg
```

数据库保存 Drive file ids 和映射关系。

未变化页面不重复上传新文件，可在 revision manifest 中引用母版/前序 Drive file id。

## 15. 历史版本展示

历史版本库必须区分：

- 框架版本（v1/v2/v3）；
- 当前领导批准母版；
- 内容修改版本（r1/r2/r3）。

领导审核框架：

- 始终使用该框架版本 P1/P2/P3 的 Google Drive 原始高清图；
- 默认三页完整同屏；
- 可以单页适屏和主动 1:1 看细节。

需求方内容验收：

- 展示当前 revision 的完整三页结果；
- 未变化页面可以来自母版，变化页面来自新 generation；
- 用户看到的是完整版本，不需要理解页面内部是否复用。

## 16. 现有系统兼容策略

### 16.1 复用

复用：

- `test_tasks.status`
- `history_json`
- `uat_requirement_sources`
- `uat_source_snapshots`
- `uat_requirement_analyses`
- `uat_design_generations`
- Google Drive relay/archive
- 现有领导 `pending_approval` 审批 UI
- 现有需求方 `reviewing → completed` 验收闭环

### 16.2 新增

新增：

- `uat_framework_templates`
- `uat_content_revisions`
- 框架驳回后的需求方“本轮框架调整要求”模块
- 领导通过后的“双入口”需求方操作区
- 内容差异计算器
- 页面级复用决策
- `seedream-template-revision-v1` Prompt
- 母版强参考生成路径

### 16.3 必须移除/禁止的旧行为

- `confirm_understanding` 自动触发 Demo 生成的旧路径必须被重新审视并改成符合明确用户授权的门禁。
- `executeAnalysis()` 在理解完成后自动 `runDemoGeneration()` 的行为不能用于后续正式流程。
- 任何旧 `processing` 状态驱动的自动全页轮询不得重新引入。
- 任何“领导通过后自动生成 final”的旧路径不得在本流程启用。

## 17. API / Action 设计

建议在现有 `uat-ai-design` 中新增明确动作，而不是隐藏在状态变化里自动触发。

### 17.1 框架阶段

`submit_framework_adjustment`

输入：

```json
{
  "task_id": "TK-0001",
  "requester_direction": "...",
  "refresh_tencent_doc": true,
  "supplemental_content": "..."
}
```

该动作只保存调整请求、刷新资料、准备新分析，不调用生成。

`generate_framework_revision`

输入：

```json
{
  "task_id": "TK-0001",
  "adjustment_id": "...",
  "idempotency_key": "..."
}
```

只有需求方点击明确生成按钮后调用。

### 17.2 母版通过后

`check_content_update`

- 只刷新 sources/snapshots；
- 返回 hash 是否变化和差异摘要；
- 不生图。

`submit_content_revision`

- 保存系统内更新文字；
- 建 revision draft；
- 计算 affected pages / capacity；
- 不生图。

`generate_content_revision`

- 必须显式提供 revision id + idempotency key；
- 只生成 affected pages；
- 使用 approved template pages 作为强输入；
- 完成后 task → `reviewing`。

`accept_current_revision`

- 直接 `complete`；
- 不生成。

## 18. 错误处理

### 18.1 腾讯文档无法读取

- 保留上一份快照；
- 不认为内容已更新；
- 提示权限/读取错误；
- 不生成。

### 18.2 内容没有变化

- 不创建 generation；
- 提示“未检测到内容变化，可直接验收当前版本”。

### 18.3 生成失败

- 当前 revision 状态标记 `failed`；
- 不破坏上一版可验收结果；
- 不自动付费重试；
- 用户可以明确点击重新尝试，新的尝试使用新的 idempotency key，并保留失败记录。

### 18.4 部分页面生成成功

- 保存已经成功页面；
- 未完成页面保持失败/待重试；
- 不把 task 提前进入可验收状态，直到 revision manifest 完整。

## 19. 迁移 TK-0001

当前 TK-0001 已存在：

- 已通过的框架版本 v-1；
- 领导 `approve_framework`；
- P1/P2/P3 Drive file ids；
- v9 confirmed analysis。

迁移时应：

1. 从 `submit_framework v-1 + approve_framework` 建立一条 `uat_framework_templates` 记录；
2. 将现有三个 ready generation 绑定为母版 pages；
3. 不产生任何 Seedream 调用；
4. task 从当前 `processing` 修正为 `reviewing`；
5. 需求方立即看到：
   - `确认验收并完结`
   - `内容需要调整`
6. 不重复找领导审批。

## 20. 测试要求

### 20.1 状态测试

必须覆盖：

- 框架驳回后 AI 不自动生成；
- 需求方未填写调整要求不能进入下一轮；
- 需求方提交调整要求后仍不自动付费生成；
- 只有显式生成动作才创建 generation；
- 领导通过后 task 进入 `reviewing`；
- 直接验收不会新增 generation；
- 内容修改后不再进入 `pending_approval`。

### 20.2 母版测试

必须覆盖：

- 一个 task 只有一个有效母版；
- 母版指向领导实际批准的框架版本；
- 后续 revision 引用母版，不改变 template id；
- 需求方没有修改母版的 API 权限。

### 20.3 内容差异测试

必须覆盖：

- hash 无变化 → 不生成；
- P2 单页变化 → 只生成 P2；
- P1/P3 复用 Drive file id；
- 页面数量变化 → capacity conflict；
- 系统内文字、腾讯文档、combined 三种 source mode。

### 20.4 Prompt/输入测试

必须覆盖：

- revision Prompt 不出现“重新设计视觉概念”等第一轮创作指令；
- 每个 affected page 第一视觉锚点是 approved template page；
- 原始 Logo/IP 资产仍被传入；
- 母版优先级高于外部 style reference。

### 20.5 计费安全测试

必须覆盖：

- `check_content_update` 0 次 provider POST；
- `submit_content_revision` 0 次 provider POST；
- `accept_current_revision` 0 次 provider POST；
- `reject_framework` 0 次 provider POST；
- provider 状态不确定时无自动付费重试。

## 21. 验收标准

该功能完成后必须满足：

1. 领导可以反复驳回框架，但每次驳回都先回需求方，不会 AI 自动重画。
2. 需求方必须把与领导沟通后的明确调整方向提交给 AI，才允许下一轮框架生成。
3. 框架一旦通过就永久成为该需求设计母版，需求方无法改风格方向。
4. 内容没变时，需求方可以直接把领导批准 Demo 验收成最终交付，完全不生图。
5. 内容变化时，系统支持腾讯文档和系统内文字两种更新来源。
6. 内容变化不会自动触发生图，只有需求方明确点击生成按钮才调用 Seedream。
7. 每轮内容修改都强制参考领导批准母版，不能发生明显风格漂移。
8. 未变化页面直接复用，只有受影响页面重新生成。
9. 内容装不下时系统要求需求方调整内容，不允许 AI 偷换框架。
10. 后续内容修改不再找领导，直接进入需求方验收。
11. 高清原图继续在 Google Drive，Supabase 只保存结构化事实和引用。
12. 全流程保留历史版本、审批意见、内容修订记录和 generation 追溯关系。
