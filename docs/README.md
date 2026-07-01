# SmartTavern 文档

SmartTavern 是 [SillyTavern](https://github.com/SillyTavern/SillyTavern)（当前锁定在 `1.18.0`）的重写版本。目标是在保留 SillyTavern 核心能力与生态兼容性的前提下，用现代技术栈消除历史技术债。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [roadmap.md](./roadmap.md) | **重构总路线图**：阶段划分、里程碑、验收标准 |
| [architecture.md](./architecture.md) | 目标架构、分层、数据模型（DB schema 设计原则） |
| [data-import.md](./data-import.md) | **旧格式数据导入规范**：角色卡 / 聊天 / 世界书 / 预设等迁移 |

## 现状（Baseline）

- 技术栈：TanStack Start（React 19 + RSC）、TanStack Router、TanStack AI、Better Auth、Drizzle ORM + PGlite、DaisyUI v5 + Tailwind v4 + Base UI、Streamdown、Paraglide i18n。
- 部署：Nitro / srvx，支持 Cloudflare 与 Docker。
- 参考实现：`./SillyTavern/`（**只读**，锁定 tag `1.18.0`），用于对照数据格式与业务逻辑。

## 为什么重写而不是继续打补丁

SillyTavern 的主要技术债：

1. **前端巨石**：`public/script.js` 等万行级 jQuery 脚本，全局可变状态，DOM 与业务逻辑强耦合，几乎无法安全重构。
2. **无类型系统**：纯 JS + JSDoc，跨模块契约靠约定，重构风险高。
3. **文件即数据库**：每用户一堆目录（`characters/`、`chats/*.jsonl`、`worlds/`…），无事务、无索引、无并发保证，靠 `writeFileAtomicSync` 兜底。
4. **服务端单体**：Express + 数十个 `src/endpoints/*.js`，鉴权、限流、代理逻辑散落各处。
5. **状态同步靠约定**：`settings.json` 全量读写，无迁移框架。

> 详细的取舍与原则见 [roadmap.md](./roadmap.md#设计原则)。
