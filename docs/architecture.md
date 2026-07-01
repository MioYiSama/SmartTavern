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

- **UI 按领域切分**（`features/characters`、`features/chat`…），而非 ST 的按技术分层。取代 `public/script.js` 巨石。
- **Server functions 取代 REST 端点**：ST 的 `src/endpoints/*.js` → 就近定义、类型化的 server functions。
- **纯逻辑与 IO 分离**：解析器、prompt 组装、WI 扫描是纯函数，易测、可复用于导入与运行时。

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

- 用户隔离：所有实体挂 `user_id`（Better Auth user）。ST 是每用户目录，这里是每用户行级隔离。
- 世界书可绑定到角色（内嵌 book）或作为全局/聊天级独立库。

## 兼容性契约

- **单向导入**：只需从 SillyTavern 格式导入进来，**不做反向导出 / 双向兼容**。
- **不丢数据**：解析遇到未知字段一律进 `extensions` / `raw`（用于运行时兜底与调试回溯，非为了导出）。
- **规范化集中**：V1→V2→V3 升级逻辑只存在于 `src/import/normalize`，运行时只面对规范模型。
