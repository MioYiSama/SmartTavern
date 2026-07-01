# 旧格式数据导入规范

> 支持导入 SillyTavern 历史数据是本次重构的**硬性需求**。参考实现见只读子模块 `./SillyTavern/`（tag `1.18.0`）。

## 目标

1. 无损导入 SillyTavern 的角色、聊天、世界书、人设、预设、分组、设置、密钥。
2. **不丢数据**：无法映射的字段保留到 `extensions` / `raw`。
3. **幂等**：重复导入不产生重复或损坏（按内容 hash / 稳定 id 去重）。
4. 支持两种入口：**单文件导入**（拖入一张角色卡/一个世界书）与**整目录/备份导入**（一个 ST 用户数据目录或备份包）。

## 架构

```
文件/Blob ──▶ 解析器(parser) ──▶ 规范化(normalize) ──▶ 规范模型 ──▶ 持久化(persist)
             按格式拆分         V1→V2→V3 升级        canonical      Drizzle 事务
```

- `src/import/parsers/*`：每种格式一个纯函数解析器，输入 bytes/JSON，输出结构化对象。
- `src/import/normalize/*`：字段升级与映射到规范模型（见 [architecture.md](./architecture.md#数据模型)）。
- `src/import/persist/*`：写入 DB（事务、去重、关联建立）。
- `src/import/__fixtures__/`：来自 `SillyTavern/default/content/` 的真实样本，驱动回归测试。

## 支持的格式

| 数据类型       | 来源格式                                                                                                        | ST 参考                        | 要点                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| 角色卡         | PNG（内嵌 `tEXt`）                                                                                              | `src/character-card-parser.js` | 读 `ccv3`(优先)→`chara`(V2)，base64 解码为 JSON     |
| 角色卡         | JSON                                                                                                            | —                              | 直接 V1/V2/V3 JSON                                  |
| 角色卡         | CHARX（zip）                                                                                                    | `src/charx.js`                 | 卡 + 资源打包                                       |
| 角色卡         | BYAF（Backyard AI）                                                                                             | `src/byaf.js`                  | 第三方格式                                          |
| 聊天           | `.jsonl`（逐行）                                                                                                | `src/endpoints/chats.js`       | 首行元数据 + 每行一条消息；含 swipes/extra          |
| 群聊           | `group chats/*.jsonl`                                                                                           | `src/endpoints/groups.js`      | 关联多角色                                          |
| 世界书         | `worlds/*.json`                                                                                                 | `src/endpoints/worldinfo.js`   | `entries` 映射；也可能内嵌于角色卡 `character_book` |
| 人设           | `User Avatars/` + `settings.json`                                                                               | `src/endpoints/avatars.js`     | 头像 + persona 描述与注入位置                       |
| 预设           | `OpenAI/TextGen/NovelAI/Kobold Settings/`、`instruct/`、`context/`、`sysprompt/`、`reasoning/`、`QuickReplies/` | `src/endpoints/presets.js`     | 按 `kind` 分类导入                                  |
| 分组           | `groups/*.json`                                                                                                 | `src/endpoints/groups.js`      | 成员 + 触发策略                                     |
| 设置           | `settings.json`                                                                                                 | `src/endpoints/settings.js`    | 拆分为结构化 `settings` 行                          |
| 密钥           | `secrets.json`                                                                                                  | `src/secrets.js`               | 加密后写入 `secrets` 表                             |
| 主题/背景/资源 | `themes/`、`backgrounds/`、`assets/`                                                                            | `src/endpoints/*`              | 二进制 → `data/fs`；DB 存路径引用                   |

> ST 每用户目录结构见 `SillyTavern/src/constants.js` 的 `USER_DIRECTORY_TEMPLATE`。

## 角色卡版本升级（V1 → V2 → V3）

- **V1**：扁平字段（`name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`）。
- **V2**（`spec: chara_card_v2`）：包一层 `data`，新增 `creator_notes`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`extensions` 等。
- **V3**（`spec: chara_card_v3`）：新增 `assets`、`group_only_greetings`、多语言等；`ccv3` chunk 优先。

规范化统一到 V3 超集；缺失字段给默认值，未知字段进 `extensions`，原始卡整体存 `raw` 以便回溯与调试。

## 幂等与去重

- 角色：按 `name + character_version + 内容 hash` 去重；重复导入更新或跳过（可选策略）。
- 聊天：按稳定来源标识（文件名/时间戳/hash）去重。
- 导入以事务提交；单条失败不污染整批（记录到导入报告）。

## 导入报告

每次导入产出结构化报告：成功/跳过/失败计数、每类实体明细、未识别字段列表、警告。用于 UI 展示与调试。

## 测试策略

- **单测**：每个解析器对 fixture 断言关键字段；normalize 覆盖 V1/V2/V3 三条路径。
- **快照**：解析 → 规范化后的规范模型做快照测试，防止映射漂移。
- **回归**：schema 变更后跑全套 fixture 导入，防止映射退化。

> 仅单向导入，不做导出/round-trip 对拍。

## 实现顺序（对应 roadmap 阶段 1）

1. PNG 角色卡解析 + V1/V2/V3 normalize（覆盖面最广，先做）。
2. 世界书 JSON + 卡内嵌 `character_book`。
3. `.jsonl` 聊天。
4. 预设（各 `kind`）。
5. `settings.json` / `secrets.json`。
6. CHARX / BYAF / 分组 / 主题等长尾格式。
