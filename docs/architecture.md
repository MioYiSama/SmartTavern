# 目标架构

> 配套 [roadmap.md](./roadmap.md)。此处定义分层与数据模型原则，具体字段随阶段 1 实现细化。

## 分层

```
┌─────────────────────────────────────────────┐
│  UI  (React 19 · Base UI · DaisyUI · Streamdown)  │  src/features/*
├─────────────────────────────────────────────┤
│  Server Functions  (TanStack Start)          │  src/server/*
│  · 领域逻辑：character / chat / lorebook / ai │
├─────────────────────────────────────────────┤
│  Domain / 纯逻辑                              │  src/import · prompt 引擎 · WI 引擎
├─────────────────────────────────────────────┤
│  Data Access  (Drizzle ORM)                  │  src/db
├──────────────────────┬──────────────────────┤
│  Postgres  (data/pg)  │  File System (data/fs)│
└──────────────────────┴──────────────────────┘
```

- **认证是一切的前置条件**：请求进入 server function / 路由加载器前必须有有效会话（Better Auth），无会话一律拒绝并重定向到登录。无任何匿名可达的领域资源。
- **UI 按领域切分**（`features/characters`、`features/chat`…），而非 ST 的按技术分层。取代 `public/script.js` 巨石。
- **Server functions 取代 REST 端点**：ST 的 `src/endpoints/*.js` → 就近定义、类型化的 server functions。
- **纯逻辑与 IO 分离**：解析器、prompt 组装、WI 扫描是纯函数，易测、可复用于导入与运行时。

## 用户与权限模型

SmartTavern 是**强制登录**的多用户应用，不存在匿名访问；所有用户**权限对等**，**不设管理员 / 超级用户角色**。

### 访问控制

- **登录前置**：除少数路由（登录、注册、密码重置等 auth 页面及 `/api/auth/*`）外，所有路由加载器与 server function 必须校验已认证会话；未认证者一律重定向至登录页，绝不返回任何领域数据。
- **无角色分层**：不引入 RBAC / admin 插件 / organization 多租户。任意用户对**自己**的数据拥有全部能力（CRUD、导入、配置密钥…），对他人数据无任何能力。
- **不特权的全局账号**：没有可读取他人数据、管理用户、查看全局统计的账号。即使是部署方/运维方也不通过应用层账号越权访问用户数据。

### 数据强隔离

强隔离是核心不变量，跨以下所有边界保证「A 用户读不到 B 用户的任何领域数据」：

| 边界          | 隔离手段                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| 结构化数据（DB） | 每张领域表带 `user_id` 外键；所有查询（server function / ORM）一律按会话 `user_id` 过滤，禁止"无 user_id 谓词"的领域查询。 |
| 文件资源（`data/fs`） | 路径以 `data/fs/<userId>/…` 为根；`FileStore` 强制注入当前会话 `userId`，拒绝跨用户路径与目录穿越。       |
| 密钥 / 设置   | `secrets`、`settings` 以 `user_id` 为主键维度，仅本人可读写。                                              |
| AI 调用       | 流式请求在 server function 内用会话 `user_id` 拉取其自己的密钥与预设，绝不暴露他人的 secrets。           |

### 落地约定

- 在数据访问层提供唯一入口（如 `db.queries` 或 repository），领域逻辑只允许传 `userId` 查询，避免散落的手写 `select` 绕过隔离。
- 单测/集成测必须包含「跨用户访问返回空/拒绝」的回归用例。
- 邀请/注册策略（是否开放注册、首用户特殊处理等）由部署配置决定，但**不改变权限平权**这一原则——即便是首个注册用户也不获得管理他人数据的能力。

## 存储策略

| 数据                     | ST 旧存储                        | SmartTavern                           |
| ------------------------ | -------------------------------- | ------------------------------------- |
| 角色                     | `characters/*.png`（内嵌 JSON）  | `characters` 表 + 头像存文件系统      |
| 聊天                     | `chats/**/*.jsonl`               | `chats` + `messages` 表               |
| 世界书                   | `worlds/*.json`                  | `lorebooks` + `lorebook_entries`      |
| 人设                     | `User Avatars/` + settings       | `personas` 表                         |
| 预设                     | `OpenAI Settings/` 等目录        | `presets` 表（含 `kind`）             |
| 分组                     | `groups/*.json` + `group chats/` | `groups` + 关联表                     |
| 设置                     | `settings.json`                  | `settings` 表（JSONB + 版本）         |
| 密钥                     | `secrets.json`                   | `secrets` 表（加密）                  |
| 二进制（头像/背景/精灵） | 各目录文件                       | 文件系统 `data/fs/<user>/…` + DB 引用 |

**数据根布局**：`data/` 下分两块，互不干扰、可分别备份/挂载卷：

```
data/
  pg/            # Postgres（PGlite）数据目录  ← 现有 data/ 内容迁到这里
  fs/            # 文件系统托管的二进制资源
    <userId>/
      avatars/     # 角色头像
      backgrounds/
      sprites/
      user-files/  # 用户上传
      thumbnails/  # 派生缩略图（可重建）
```

- 结构化数据（角色、聊天、世界书…）进 **`data/pg`**（DB）；二进制资源进 **`data/fs`**，按用户隔离。
- 定义一个薄封装 `FileStore`（`put/get/path/delete`），只负责路径解析、用户隔离、防目录穿越（对照 ST `src/util.js` 的路径校验）与原子写（`writeFileAtomic`）。**不是对象存储抽象**——就是 `node:fs`。
- DB 只存**相对路径**（相对 `data/fs`）+ 元数据（mime、尺寸、内容 hash 用于去重）。数据根由配置指定（默认 `./data`，`DATABASE_URL` 指向 `data/pg`）。
- 缩略图等派生文件视为缓存，可随时按原图重建。

> 现状：`.env.example` 已将 `DATABASE_URL` 指向 `data/pg`，`.gitignore` 已忽略整个 `data/`。仓库里遗留的 `data/pg_*` 目录是切换前生成的，阶段 0 清掉即可；`data/fs` 首次写入时自动创建。

## 数据模型

以 **角色卡 V3 规范**为超集设计内部规范模型（canonical model），向下兼容 V1/V2。核心实体（字段最终以 Drizzle schema 为准）：

### characters

V3 超集：`name` · `description` · `personality` · `scenario` · `first_mes` · `mes_example` · `creator_notes` · `system_prompt` · `post_history_instructions` · `alternate_greetings[]` · `tags[]` · `creator` · `character_version` · `avatar(blobRef)` · `character_book(fk→lorebooks, 可选)` · `assets[]` · `extensions(jsonb)` · `raw(jsonb, 原始卡备份)`。

### chats / messages

- `chats`：关联 character 或 group、标题、时间、`metadata(jsonb)`。
- `messages`：`role`(user/assistant/system) · `content` · `swipes[]` · `swipe_id` · `name` · `extra(jsonb)` · `created_at`。取代 jsonl 逐行结构，保留原 ST 消息扩展字段。

### lorebooks / lorebook_entries

- entry：`keys[]` · `secondary_keys[]` · `content` · `constant` · `selective` · `insertion_order` · `position` · `depth` · `probability` · `enabled` · `extensions(jsonb)`。对齐 ST WI entry 结构，供 WI 引擎消费。

### 其它

`personas` · `presets(kind: openai|textgen|instruct|context|sysprompt|reasoning|quickreply)` · `groups` + `group_members` · `settings(user_id, key, value jsonb, version)` · `secrets(user_id, provider, ciphertext)` · `assets(blob 元数据)`。

### 关系

- **用户隔离（强隔离不变量）**：所有领域实体挂 `user_id`（Better Auth user），非空、外键约束。ST 是每用户目录，这里是每用户**行级隔离**——查询必须带 `user_id` 谓词，跨用户读取必须返回空。详见前文 [用户与权限模型](#用户与权限模型)。
- 世界书可绑定到角色（内嵌 book）或作为全局/聊天级独立库（仍归属同一 `user_id`）。

### ID 约定

- **统一主键策略**：所有表主键一律 `uuid` 类型，默认值用 PostgreSQL 18 内置 `pg_catalog.uuidv7()` 生成——**不用** `gen_random_uuid()`（UUIDv4，无序），**不**在应用层 JS 侧手搓 ID。
- 理由：UUIDv7 时间有序，B-tree 友好，索引写放大低、范围扫描快，便于按时间排查与排序；同时全局唯一，适配多用户、可分库的演进。本地 PGlite（v0.5.3 跑的是 PG 18.3）与生产 Postgres 18 都内置 `uuidv7()`，行为一致，无需扩展。
- Drizzle 落法：`id: uuid("id").primaryKey().default(sql\`uuidv7()\`)`（`import { sql } from "drizzle-orm"`）。所有外键 `user_id` / `character_id` / `chat_id` 等同样 `uuid` 类型。
- **Better Auth 表**（`user` / `session` / `account` / `verification`）随此约定：主键列升级为 `uuid().default(sql\`uuidv7()\`)`；Better Auth 本身的 ID 生成改走 DB 生成——配置 Better Auth `advanced.database.generateId = false`（或等价的「不自增、不内置 ID」开关），让其在 insert 时不带 `id`、由 PG default 填 `uuidv7()`。若 Better Auth 强制要求应用层产 ID，则用等价的 JS 端 UUIDv7 实现 **仅**用于 auth 表的兼容写入，并断言其值与 DB `uuidv7()` 同形（RFC 9562 UUIDv7）。

## AI 供应商层

取代 ST 散落在 `src/endpoints/{openai,anthropic,google,openrouter,…}.js` 的供应商逻辑，统一基于 **TanStack AI 适配器** + **BYOK**。

### BYOK 原则

- 大模型访问**一律 BYOK**：apiKey 与 **baseURL** 全部由用户本人在应用内自填、加密存入 `secrets` 表（按 `user_id` 隔离）。每个一级供应商（OpenAI / Anthropic / Gemini / OpenRouter）连同「OpenAI 兼容端点」都允许自填 baseURL，覆盖自部署网关、代理、第三方兼容端点等场景。
- 应用**不内置任何共享 / 平台 / 管理员级 API key**，不为无密钥用户提供任何兜底入口；缺凭据即无法发起该供应商的请求。
- server function 发起请求前，凭据从会话 `user_id` 解密读出，注入适配器工厂 config（`{ apiKey, baseURL }`），**绝不读环境变量**，绝不跨用户。

### 适配器与 API 格式

`chat()` 的 `adapter` 由「provider+model(+apiFormat) → adapter 工厂」map 在运行时解析；模型名传给工厂、不传 `chat()`。

| 供应商 / 端点类型    | 包                              | 工厂                                    | OpenAI API 格式          | 自填 baseURL |
| -------------------- | ------------------------------- | --------------------------------------- | ------------------------ | ------------ |
| OpenAI 官方（新一代） | `@tanstack/ai-openai`           | `openaiText`                            | **Responses API**        | 支持          |
| OpenAI 官方（兼容旧） | `@tanstack/ai-openai`           | `openaiChatCompletions`                 | **Chat Completions API**（`/v1/chat/completions`） | 支持 |
| 任意 OpenAI 兼容端点 | `@tanstack/ai-openai/compatible` | `openaiCompatible` / `openaiCompatibleText` | Chat Completions 线格式  | 支持（必填维） |
| Anthropic / 兼容端点 | `@tanstack/ai-anthropic`        | `anthropicText`                         | —                        | 支持（经 `@anthropic-ai/sdk` `ClientOptions.baseURL`） |
| Google Gemini / 兼容端点 | `@tanstack/ai-gemini`       | `geminiText`                            | —                        | 支持（经 `@google/genai` `httpOptions.baseUrl`） |
| OpenRouter           | `@tanstack/ai-openrouter`       | `openRouterText`                        | —                        | 支持          |

- **`openaiText`（Responses）vs `openaiChatCompletions`（Chat Completions）必须显式区分**：前者是 OpenAI 新一代 Responses 端点，是 `openaiText` 的默认行为，支持 reasoning effort / service tier / store / conversation 等新选项；后者走老版 `/v1/chat/completions` 线格式，用于需要旧 wire 兼容或与只认该格式下游对拍的场景。两者同出 `@tanstack/ai-openai`，按 `apiFormat` 维度在适配器 map 里并列。
- **真实 OpenAI 官方源默认走 `openaiText`（Responses）**；**任何「自填 baseURL 的非官方 OpenAI 兼容端点」走 `openaiChatCompletions` 或 `openaiCompatible`（Chat Completions 线）**——第三方网关 / 自部署 vLLM / DeepSeek / Together 等基本只说 Chat Completions。
- **baseURL 是全部一级供应商的可配维度**，不止 OpenAI 兼容网关：
  - `anthropicText(model, { apiKey, baseURL })` — 经 `@anthropic-ai/sdk` 的 `ClientOptions.baseURL` 转发，用于 Anthropic 官方之外的兼容网关 / 自部署端点。
  - `geminiText(model, { apiKey, httpOptions: { baseUrl } })` — 经 `@google/genai` 的 `GoogleGenAIOptions.httpOptions.baseUrl` 转发，用于 Gemini 兼容端点。
  - `openRouterText` 同样接受 baseURL 覆盖（默认 `https://openrouter.ai/api/v1`，可改指向自部署 / 代理）。
- 配置注入范式（全部 `{ apiKey, baseURL }` 取自当前用户 BYOK 凭据）：`openaiText(model, { apiKey, baseURL })` / `openaiChatCompletions(model, { apiKey, baseURL })` / `openaiCompatible({ baseURL, apiKey, models })` / `anthropicText(model, { apiKey, baseURL })` / `geminiText(model, { apiKey, httpOptions: { baseUrl } })` / `openRouterText(model, { apiKey, baseURL })`。
- 采样参数按各 provider 原生键经 `modelOptions` 传入（如 OpenAI 的 `temperature` / `max_output_tokens` / `reasoning`），不在 `chat()` 顶层。

### 流式

- server 端：`chat()` 产出的 stream 用 `toServerSentEventsResponse()` 转 SSE。
- 客户端：`useChat` + `fetchServerSentEvents()` 消费，Streamdown 做增量 Markdown 渲染。
- 全程在单一 server function 内完成凭据解密 → 适配器构造 → 流式转发，凭据不离开服务端。

## 兼容性契约

- **单向导入**：只需从 SillyTavern 格式导入进来，**不做反向导出 / 双向兼容**。
- **不丢数据**：解析遇到未知字段一律进 `extensions` / `raw`（用于运行时兜底与调试回溯，非为了导出）。
- **规范化集中**：V1→V2→V3 升级逻辑只存在于 `src/import/normalize`，运行时只面对规范模型。
