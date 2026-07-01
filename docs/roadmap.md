# SmartTavern 重构路线图

> 状态图例：⬜ 未开始 · 🟡 进行中 · ✅ 完成
> 本路线图为活文档，随实现推进持续更新。

## 目标

用现代、可测试、类型安全的架构重写 SillyTavern，做到：

1. **消除技术债**：模块化前端、端到端类型安全、数据库驱动的存储。
2. **生态兼容**：能无损导入 SillyTavern 的历史数据（角色卡 V2/V3、聊天、世界书、预设等），详见 [data-import.md](./data-import.md)。
3. **多用户 / 可部署**：Better Auth 鉴权，强制登录，单实例多用户且**数据强隔离**，所有用户权限对等、**不设管理员**，支持本地 / Docker / Cloudflare。
4. **渐进可用**：每个阶段结束都能跑起来、能用、能自测，而不是"憋大招"。

## 设计原则

- **兼容性是需求，不是彩蛋**：导入器（importer）作为一等公民贯穿始终，旧格式是「输入契约」。
- **数据库优先**：以 Postgres（PGlite 本地 / Postgres 生产）为唯一事实来源，文件仅作为导入的输入边界。
- **类型贯穿全栈**：Drizzle schema → 服务端函数 → 客户端，杜绝 `any` 契约。
- **服务端函数而非 REST 巨石**：用 TanStack Start server functions 替代 `src/endpoints/*.js`，就近定义、天然类型化。
- **面向流式的 AI 层**：以 TanStack AI + Streamdown 为核心，替换手写 SSE / fetch 逻辑。
- **BYOK（Bring Your Own Key）**：大模型 API 一律由**用户本人**提供并加密存储自己的密钥；应用**不内置任何共享 / 平台 / 管理员级 API Key**，也不为无密钥用户提供任何兜底入口。密钥严格按用户隔离，仅用于发起该用户的请求。
- **可测试**：解析器、迁移、prompt 组装等纯逻辑必须有单测；ST 原始样本作为 fixture。

---

## 阶段总览

| 阶段 | 主题                    | 产出                                | 依赖 |
| ---- | ----------------------- | ----------------------------------- | ---- |
| 0    | 地基与工程化            | 项目骨架、CI、测试、schema 迁移框架 | —    |
| 1    | 数据模型与导入内核      | DB schema + 旧格式解析/导入库       | 0    |
| 2    | 角色与聊天 MVP          | 角色列表、单角色对话、消息持久化    | 1    |
| 3    | AI 供应商与 Prompt 引擎 | 多供应商、流式、prompt 组装、预设   | 2    |
| 4    | 世界书 / Lorebook       | WI 引擎、编辑器、与角色绑定         | 2    |
| 5    | 人设 / 分组 / 富交互    | Persona、群聊、正则、快速回复       | 3,4  |
| 6    | 扩展性与设置            | 主题、设置迁移、扩展点              | 3    |
| 7    | 打磨与发布              | 性能、移动端/PWA、文档、1.0         | 全部 |

每个阶段的 **Exit Criteria（验收标准）** 见下文。

---

## 阶段 0 · 地基与工程化 ⬜

打好可持续开发的地基，避免重蹈"没有测试、没有类型契约"的覆辙。

- [ ] 确立目录约定：`src/db`（schema）、`src/server`（server functions / 领域逻辑）、`src/features/*`（按领域切分 UI）、`src/lib`（通用）、`src/import`（迁移内核）。
- [ ] Drizzle 迁移工作流：从 `db:push`（原型期）过渡到版本化 migration（`drizzle-kit generate`），确立"schema 变更即 migration"的纪律。
- [ ] **Better Auth 接入 + 强制登录骨架**：email/password 会话、`/api/auth/*` 路由、登录/注册页；除 auth 页面与 `/api/auth/*` 外，所有路由加载器与 server function 强制校验会话，未认证一律重定向至登录。**不引入 admin / organization / RBAC 插件**——全体用户平权。注册策略（开放/关闭/邀请码）由环境配置控制，但首用户也不获得特权。
- [ ] 测试框架接入（Vitest），约定：解析器/迁移/prompt 组装必须有单测；并新增"未认证请求被拒""跨用户读返回空"两类回归用例骨架。
- [ ] 准备 **fixture 语料**：从 `SillyTavern/default/content/` 复制少量样本（Seraphina 角色卡、Eldoria 世界书、各类 preset）到 `src/import/__fixtures__/`，作为导入回归基准。
- [ ] CI（GitHub Actions）：lint + typecheck + test。
- [ ] 错误/日志约定与配置加载（`config.yaml` 对应项梳理）。

**Exit**：`pnpm test` / `pnpm lint` 在 CI 通过；能对一个 fixture 跑通空的迁移用例；**未认证请求被重定向至登录页，已认证用户无法访问他人 `data/fs/<userId>` 路径**。

---

## 阶段 1 · 数据模型与导入内核 ⬜

这是整个重构的地基性阶段，也是"支持旧格式导入"的核心。**先定 schema，再写导入器，用真实 fixture 驱动。**

- [ ] 设计核心 DB schema（详见 [architecture.md](./architecture.md#数据模型)）：
  - **ID 约定**：所有表主键 `uuid` + `default uuidv7()`（PG18 内置，本地 PGlite 18.3 已验证可用）；不用 `gen_random_uuid()`、不在 JS 侧手搓 ID。Better Auth 表同步迁移，`advanced.database.generateId` 关掉以让 DB 生成。
  - `characters`（V3 超集：description / personality / scenario / first_mes / alternate_greetings / character_book / extensions / assets…）
  - `chats` + `messages`（替代 `.jsonl`，保留 swipes、扩展元数据）
  - `lorebooks` + `lorebook_entries`（世界书）
  - `personas`、`presets`（按类型分：openai/textgen/instruct/context/sysprompt/reasoning）
  - `groups` + 成员关联、`chat` 关联到 character/group
  - `settings`（用户级 KV / JSONB）、`secrets`（加密的 API key）、`assets`（头像/背景 blob 引用）
- [ ] 资源存储策略：结构化数据进 DB（`data/pg`）；头像/背景/精灵等二进制走文件系统（`data/fs/<user>/…`），DB 只存相对路径与元数据。薄封装 `FileStore`（原子写 + 防目录穿越 + **强制以会话 `userId` 为根，拒绝跨用户路径**）。
- [ ] **数据访问层强制用户隔离**：提供统一查询入口（repository / `db.queries`），所有领域查询必须传入并按 `userId` 过滤；禁止裸 `select` 绕过隔离。导入器写入也挂当前会话 `user_id`。
- [ ] **导入内核**（`src/import/`），按格式拆分解析器：
  - PNG 角色卡：解码 `tEXt` chunk 中的 `ccv3`（优先）/ `chara`（V2）base64 JSON —— 对照 `SillyTavern/src/character-card-parser.js`。
  - CHARX / BYAF：对照 `charx.js` / `byaf.js`。
  - JSON 角色卡、世界书 JSON、`.jsonl` 聊天、各类 preset、`settings.json`。
- [ ] **规范化层**：V1→V2→V3 字段升级，统一映射到内部规范模型（canonical model），保留未知字段到 `extensions`（不丢数据）。
- [ ] 每个解析器配 fixture 单测（解析→规范化后对规范模型做快照，字段不丢失）。

**Exit**：能用脚本把一个真实 SillyTavern 用户数据目录导入到空库（数据归属当前登录用户），并断言角色/聊天/世界书数量与关键字段正确；**跨用户查询同一实体返回空**的回归用例通过。详见 [data-import.md](./data-import.md)。

---

## 阶段 2 · 角色与聊天 MVP ⬜

第一次"能用"：导入角色 → 打开 → 对话 → 消息落库。

- [ ] 角色库 UI：网格/列表、搜索、导入按钮（复用阶段 1 导入器）。
- [ ] 角色详情/编辑（先只读或基础字段）。
- [ ] 聊天视图：消息列表用 Streamdown 渲染 Markdown；发送/接收；持久化到 `messages`。
- [ ] 聊天管理：多聊天、切换、重命名、删除。
- [ ] 头像/背景资源展示（走 `FileStore`，从 `data/fs` 读取）。
- [ ] 端到端跑通：server function 读写 DB，客户端乐观更新。

**Exit**：导入 Seraphina → 新建聊天 → 用一个 mock/真实供应商发消息 → 刷新后消息仍在。

---

## 阶段 3 · AI 供应商与 Prompt 引擎 ⬜

替换 ST 里散落在 `src/endpoints/{openai,anthropic,google,openrouter,…}.js` 的供应商逻辑。

- [ ] 供应商抽象层：以 TanStack AI 的适配器工厂为核心，按 provider 各装一个包——
  - `@tanstack/ai-openai`：区分两套 OpenAI 官方 API 格式——
    - `openaiText` → **Responses API**（OpenAI 新一代端点，默认走这个，支持 reasoning / service tier / store 等新选项）。
    - `openaiChatCompletions` → **Chat Completions API**（`/v1/chat/completions`，老版兼容格式，给只认旧 wire 格式的下游用）。
    二者同包，按「OpenAI 官方源 → Responses；OpenAI 兼容端点 → Chat Completions / `openaiCompatible`」分流。
  - `@tanstack/ai-anthropic` · `anthropicText`
  - `@tanstack/ai-gemini` · `geminiText`
  - `@tanstack/ai-openrouter` · `openRouterText`
  - 通用 OpenAI 兼容供应商走 `@tanstack/ai-openai/compatible` 的 `openaiCompatible`（Chat Completions 线格式，覆盖 DeepSeek / Together / 自部署 vLLM / 第三方网关等任意自填 baseURL 的端点）。
  - 用「provider+model(+apiFormat) → adapter 工厂」map 做运行时切换；模型名传给工厂、不传 `chat()`。
- [ ] **Base URL 可配（所有供应商）**：每个适配器工厂的第二参 config 都允许自填 `baseURL`（与 `apiKey`）；二者的值**来自当前会话用户在 `secrets` 表里自填的 BYOK 凭据**（不读环境变量、不内置平台共享 key）。
  - OpenAI：`openaiText(model, { apiKey, baseURL })` / `openaiChatCompletions(model, { apiKey, baseURL })` / `openaiCompatible({ baseURL, apiKey, models })`。
  - Anthropic：`anthropicText(model, { apiKey, baseURL })`（转发到 `@anthropic-ai/sdk` `ClientOptions.baseURL`）。
  - Gemini：`geminiText(model, { apiKey, httpOptions: { baseUrl } })`（转发到 `@google/genai` `GoogleGenAIOptions.httpOptions.baseUrl`）。
  - OpenRouter：`openRouterText(model, { apiKey, baseURL })`（默认 `https://openrouter.ai/api/v1`，可改）。
- [ ] 流式：`chat()` + `toServerSentEventsResponse()` 在 server function 转发 → 客户端 `useChat` + Streamdown 增量渲染。
- [ ] **BYOK Secrets 管理**：加密存储用户自填的 apiKey + baseURL（对照 ST `secrets.js`），按 `user_id` 强隔离；UI 让用户为每个 provider（OpenAI / Anthropic / Gemini / OpenRouter / 兼容端点）配置凭据。应用不提供任何兜底 / 共享 key。
- [ ] **Prompt 组装引擎**：角色定义 + persona + 世界书注入 + 历史 + 预设，按顺序/深度组装（对照 ST `prompt-converters.js` 与 openai 预设的 prompt order）。
- [ ] 预设系统：导入并应用 OpenAI/TextGen preset；参数面板（温度、采样等，经 `modelOptions` 原生键传给适配器）。
- [ ] Token 计数与上下文裁剪。
- [ ] Swipes（重roll）、编辑、续写、重新生成。

**Exit**：用自填 BYOK key + 自定义 baseURL 接入真实供应商（OpenAI / Anthropic / Gemini / OpenRouter 任一，或一个 OpenAI 兼容端点），完成一次带世界书注入的多轮对话；切换/编辑预设即时生效。

---

## 阶段 4 · 世界书 / Lorebook ⬜

- [ ] WI 引擎：关键字扫描、常量条目、递归扫描、深度/顺序/概率、position 注入（对照 `worldinfo.js` 与 `char-data.js` 中的 WI entry 结构）。
- [ ] 世界书编辑器 UI（条目 CRUD、批量、启用/禁用）。
- [ ] 与角色绑定（`character_book`）、全局/聊天级世界书。
- [ ] 导入器覆盖世界书 JSON 与卡内嵌 book（阶段 1 已解析，此处接 UI + 引擎）。

**Exit**：导入 Eldoria 世界书，触发关键字后正确注入到 prompt。

---

## 阶段 5 · 人设 / 分组 / 富交互 ⬜

- [ ] Persona 管理（用户人设、头像、描述注入位置）。
- [ ] 群聊：多角色、发言顺序/触发策略（对照 `groups.js`）。
- [ ] 正则脚本（regex）、快速回复（quick replies）。
- [ ] 作者注释（author's note）、消息级扩展元数据。

**Exit**：导入含 persona 的旧数据、创建群聊并进行多角色对话。

---

## 阶段 6 · 扩展性与设置 ⬜

- [ ] 设置系统：从 `settings.json` 迁移到结构化 `settings` 表；设置版本与迁移。
- [ ] 主题（DaisyUI 主题 + 自定义 CSS，对照 `themes/` 与 `user.css`）。
- [ ] 扩展点设计（先定义边界，不必实现完整扩展生态）。

> 不做反向导出 / 与 SillyTavern 的双向兼容——只保证单向导入。

**Exit**：设置从 `settings.json` 结构化迁移完成并可编辑；主题可切换。

---

## 阶段 7 · 打磨与发布 ⬜

- [ ] 性能：大聊天虚拟滚动、导入大批量数据的批处理。
- [ ] 移动端 / PWA（已有 vite-plugin-pwa）。
- [ ] i18n 覆盖（Paraglide，en/zh 已有骨架）。
- [ ] 用户文档 + 迁移指南。
- [ ] 1.0 发布与部署验证（Docker / Cloudflare）。

**Exit**：从零部署，导入历史数据，完成一次真实使用；发布 1.0。

---

## 跨阶段的持续事项

- **导入兼容性回归**：每次改 schema，跑全套 fixture 导入测试。
- **数据不丢失原则**：任何解析器遇到未知字段，落到 `extensions`/`raw` 而非丢弃。
- **迁移可重放**：导入具备幂等性（可重复导入不产生重复/损坏）。
- **用户隔离回归**：每次新增领域表 / server function / 资源路径，必须带 `user_id` 谓词并补"跨用户访问返回空"用例；定时审计防止裸查询绕过隔离。
- **无特权账户纪律**：任一阶段都不引入 admin / superuser / organization 等角色分层；新功能默认对所有登录用户平权开放。

## 关键风险

| 风险                                               | 缓解                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| 旧格式碎片化（V1/V2/V3、CHARX、BYAF、各家 preset） | 阶段 1 用规范化层统一；真实 fixture 驱动；未知字段保底 |
| Prompt 组装语义与原版不一致，导致输出漂移          | 对照 `prompt-converters.js`，用固定输入做快照测试      |
| PGlite 在生产规模下的表现                          | 存储层抽象，保留切换到标准 Postgres 的能力             |
| 范围蔓延（想一次做完 ST 所有功能）                 | 严格按阶段 Exit Criteria 交付，非核心功能后置          |
| 用户数据越权 / 隔离被绕过                          | 统一查询入口强制 `user_id` 过滤；`FileStore` 注入会话用户；隔离回归测试进 CI |
| 新功能显性 / 隐性引入角色分层                      | 跨阶段纪律明令禁止 admin/RBAC；代码评审把关权限点 |
