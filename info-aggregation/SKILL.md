---
name: info-aggregation
description: 信息聚合。用于从固定 TFT、AI、生活内容源抓取昨天的动态、新闻、攻略、论坛热帖或 X posts，并写入当天日记；使用固定平台与博主清单，不使用通用搜索引擎临时搜索；只保留主待办复选框，并按日期范围统计来源活跃度。
---

# 信息聚合

通过 Playwright 使用固定浏览器 profile，并启动系统 Chrome，从固定内容源页面提取昨天的新内容、论坛热帖、X posts 和摘要，并写入当天日记。

## Workflow

1. 默认只抓取运行日（Asia/Shanghai）的昨天数据，避免和当天临时内容重复；不要把今天发布的 Tacter、TFTips 或 X 内容写入日记。
2. 使用 `scripts/browser-diary.mjs --source="Tacter"` 处理 TFT Tacter 来源；使用 `scripts/reddit-diary.mjs` 处理 Reddit 来源；使用 `scripts/x-diary.mjs` 处理 AI/生活模块 X 来源。
3. 不使用通用搜索引擎，不临时发散搜索。
4. 固定来源来自 [TFT Sources](references/tft-sources.md) 的 Source Registry；只有启用列为 `[x]` 的来源进入默认抓取，当前默认启用 Tacter、Reddit 与 X：
   - TFTtomus：`https://www.tacter.com/@tfttomus`
   - ExTIRIA：`https://www.tacter.com/@extiria`
   - CompetitiveTFT：`https://www.reddit.com/r/CompetitiveTFT/hot/`
   - TeamfightTactics：`https://www.reddit.com/r/TeamfightTactics/hot/`
   - TFT 模块 Reddit 用户：Lunaedge `https://www.reddit.com/user/Lunaedge/submitted/`
   - AI 模块 Reddit：`https://www.reddit.com/r/vibecoding/hot/`
   - AI 模块 Reddit：`https://www.reddit.com/r/MachineLearning/hot/`
   - AI 模块 X：Elon Musk `https://x.com/elonmusk`
   - AI 模块 X：sama `https://x.com/sama`
   - AI 模块 X：karpathy `https://x.com/karpathy`
   - AI 模块 X：AndrewYNg `https://x.com/AndrewYNg`
   - AI 模块 X：lexfridman `https://x.com/lexfridman`
   - AI 模块 Linux.do 跳转入口：`https://linux.do/c/develop/4/l/top?period=weekly`
   - 生活模块 Reddit：`https://www.reddit.com/r/nutrition/hot/`
   - 生活模块 Reddit：`https://www.reddit.com/r/badbreath/hot/`
   - 生活模块 Reddit：`https://www.reddit.com/r/Parenting/hot/`
   - 生活模块 X：Mark_Sisson `https://x.com/Mark_Sisson`
   - 生活模块 X：foundmyfitness `https://x.com/foundmyfitness`
5. 必须使用固定 `--user-data-dir="D:\tmp\chrome-cdp-profile"` 启动和复用独立 Chrome profile。
   - 如果该 profile 被占用或提示已有浏览器会话打开，先按「Profile 占用处理」终止明确占用该固定 profile 的 Chrome 进程，然后用同一个 profile 重试一次。
   - 如果重试仍失败，或是权限访问、页面采集、登录挑战等非占用问题，立即停止本次任务并向用户报告原始错误。
   - 不要创建或切换到临时/备用 profile（例如 `D:\tmp\chrome-cdp-profile-info-aggregation`），也不要改用默认 Chrome profile 继续执行。
6. 所有 TFT 平台只要进入中文总结流程，都必须参考本 skill 内置的 `references/terms` 术语表；英文内容优先使用 `en_to_zh.csv`，先统一翻译游戏术语，再生成中文总结，避免自行乱译英雄、特质、装备、强化符文和运营术语。
7. Tacter 页面先采集结构化候选项，只保留昨天发布或更新的内容，再进入攻略详情页提取正文可见文本；结合 `references/terms/en_to_zh.csv` 先统一翻译游戏术语，再生成中文总结，并写入 `#### Tacter` 每条任务下方的 `> [!summary]- 中文总结`。
8. Reddit 使用 `scripts/reddit-diary.mjs` 单独处理：分别抓取 CompetitiveTFT 与 TeamfightTactics hot 第一条帖子的标题、链接、正文和热门评论，并抓取 Reddit 用户 Lunaedge 昨日发布的 submitted 帖子；结合 `references/terms` 术语表交给 AI 生成中文总结，并写入 `## TFT 信息聚合` 下的 `#### Reddit` 平台分组；Reddit hot 流不保证严格昨日，只有页面或 JSON 元数据能确认发帖日期时才把它计入昨日活跃。
9. AI 模块 Reddit 使用 `scripts/reddit-diary.mjs --section=ai` 单独处理：抓取 vibecoding 与 MachineLearning hot 第一条帖子的标题、链接、正文和热门评论，生成中文总结，并写入 `## AI` 下的 `#### Reddit` 平台分组。
10. AI 模块 X 使用 `scripts/x-diary.mjs` 单独处理：抓取 Elon Musk、sama、karpathy、AndrewYNg、lexfridman 主页昨天的 posts；优先在主页时间线点击 `Show more`/`显示更多` 展开正文，只有主页正文仍疑似截断时才进入 status 页补正文；交给 AI 直接翻译为中文，并写入 `## AI` 下的 `#### X` 平台分组。
11. AI 模块 Linux.do 不做自动抓取；只在 `## AI` 下的 `#### Linux.do` 平台分组写入每周排行榜跳转链接。
12. 生活模块 Reddit 使用 `scripts/reddit-diary.mjs --section=life` 单独处理：抓取 nutrition、badbreath 与 Parenting hot 第一条帖子的标题、链接、正文和热门评论，生成中文总结，并写入 `## 生活` 下的 `#### Reddit` 平台分组。
13. 生活模块 X 使用 `scripts/x-diary.mjs --section=life` 单独处理：抓取 Mark_Sisson、foundmyfitness 主页昨天的 posts；优先在主页时间线点击 `Show more`/`显示更多` 展开正文，只有主页正文仍疑似截断时才进入 status 页补正文；交给 AI 直接翻译为中文，并写入 `## 生活` 下的 `#### X` 平台分组。
14. 写入当天日记：`10 日记/YYYY-MM-DD.md`。
15. 若日记中已有 `## TFT 信息聚合`、`## AI` 或 `## 生活` 区块，更新对应平台分组并保留其他平台分组；否则追加新区块。
16. 只有真实抓到的新内容使用标题链接和主待办复选框；抓取失败时才写入普通失败列表；无失败不输出失败区。
17. `## TFT 信息聚合`、`## AI` 或 `## 生活` 下直接按平台分组，每条内容使用主待办复选框作为标题行，下面保留隐藏来源注释；不输出 `### 待处理`，作者、描述、发布时间、检索日期不写入可见正文。
18. `discussion`、`summary`、翻译稿等中间文件只作为本次运行临时产物，统一放在 `D:\tmp\info-aggregation`；写入当天日记并确认成功后必须删除，不保留在技能目录或仓库工作区中。

## Source Maintenance

1. 来源维护表在 [TFT Sources](references/tft-sources.md) 的 `## Source Registry`。
2. `启用` 使用 `[x]`/`[ ]` 控制默认抓取；新增来源默认 `[ ]`，除非用户明确要求启用。
3. 每条内容或来源项的主待办复选框表示是否处理过。
4. 每条内容或来源项还要带一行隐藏来源注释，例如 `%% source: AI|X|Elon Musk|https://x.com/elonmusk %%`；统计时按这个来源键聚合。
5. 当用户给出日期范围并要求统计时，运行 `scripts/source-feedback.mjs --from=YYYY-MM-DD --to=YYYY-MM-DD`，从日记中统计每个来源的命中、已处理、未处理和最近命中日期。
6. `近30天命中`、`最近命中`、`活跃度` 由 Codex 根据用户指定周期或最近 30 天日记统计维护；不要凭印象改分。
7. 活跃度建议：周期命中 `>=3` 记为 `活跃`，`1-2` 记为 `低活跃`，`0` 记为 `不活跃`；连续抓取失败记为 `异常`。
8. 当用户要求“更新固定来源”或“整理来源”时，先统计活跃度，再给出保留、降级观察、停用或新增建议。

## Browser Command

先用独立 profile 打开 Chrome 登录：

```powershell
& "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\tmp\chrome-cdp-profile" --no-first-run --no-default-browser-check
```

关闭这个窗口后，再运行 Tacter 平台采集，复用同一个 profile。以下 `scripts/...` 路径相对本 skill 目录：

```powershell
node scripts/browser-diary.mjs --user-data-dir="D:\tmp\chrome-cdp-profile" --source="Tacter"
```

抓取 Tacter 攻略详情并打印给 AI 的术语翻译 + 总结 prompt：

```powershell
node scripts/browser-diary.mjs --user-data-dir="D:\tmp\chrome-cdp-profile" --source="Tacter" --output-discussion="D:\tmp\info-aggregation\tacter-discussion.json" --terms-file="references/terms/en_to_zh.csv"
```

AI 生成中文总结后写入当天日记：

```powershell
node scripts/browser-diary.mjs --user-data-dir="D:\tmp\chrome-cdp-profile" --source="Tacter" --discussion-file="D:\tmp\info-aggregation\tacter-discussion.json" --summary-file="D:\tmp\info-aggregation\tacter-summary.md"
```

抓取 Reddit hot 第一帖并打印给 AI 的摘要 prompt：

```powershell
node scripts/reddit-diary.mjs --user-data-dir="D:\tmp\chrome-cdp-profile" --output-discussion="D:\tmp\info-aggregation\reddit-discussion.json"
```

抓取 AI 模块 Reddit hot 第一帖并打印给 AI 的摘要 prompt：

```powershell
node scripts/reddit-diary.mjs --section=ai --user-data-dir="D:\tmp\chrome-cdp-profile" --output-discussion="D:\tmp\info-aggregation\ai-reddit-discussion.json"
```

抓取生活模块 Reddit hot 第一帖并打印给 AI 的摘要 prompt：

```powershell
node scripts/reddit-diary.mjs --section=life --user-data-dir="D:\tmp\chrome-cdp-profile" --output-discussion="D:\tmp\info-aggregation\life-reddit-discussion.json"
```

抓取 AI 模块 X posts 并打印给 AI 的翻译 prompt：

```powershell
node scripts/x-diary.mjs --user-data-dir="D:\tmp\chrome-cdp-profile" --output-discussion="D:\tmp\info-aggregation\x-discussion.json"
```

抓取生活模块 X posts 并打印给 AI 的翻译 prompt：

```powershell
node scripts/x-diary.mjs --section=life --user-data-dir="D:\tmp\chrome-cdp-profile" --output-discussion="D:\tmp\info-aggregation\life-x-discussion.json"
```

AI 生成中文总结后写入当天日记：

```powershell
node scripts/reddit-diary.mjs --discussion-file="D:\tmp\info-aggregation\reddit-discussion.json" --summary-file="D:\tmp\info-aggregation\reddit-summary.md"
```

AI 模块 Reddit 生成中文总结后写入当天日记：

```powershell
node scripts/reddit-diary.mjs --section=ai --discussion-file="D:\tmp\info-aggregation\ai-reddit-discussion.json" --summary-file="D:\tmp\info-aggregation\ai-reddit-summary.md"
```

生活模块 Reddit 生成中文总结后写入当天日记：

```powershell
node scripts/reddit-diary.mjs --section=life --discussion-file="D:\tmp\info-aggregation\life-reddit-discussion.json" --summary-file="D:\tmp\info-aggregation\life-reddit-summary.md"
```

AI 模块 X 生成中文翻译后写入当天日记：

```powershell
node scripts/x-diary.mjs --discussion-file="D:\tmp\info-aggregation\x-discussion.json" --summary-file="D:\tmp\info-aggregation\x-summary.md"
```

生活模块 X 生成中文翻译后写入当天日记：

```powershell
node scripts/x-diary.mjs --section=life --discussion-file="D:\tmp\info-aggregation\life-x-discussion.json" --summary-file="D:\tmp\info-aggregation\life-x-summary.md"
```

## Profile 占用处理

当脚本报错包含 `Target page, context or browser has been closed`、`已有浏览器会话打开`、`already in use` 或类似 Chrome profile 占用信息时：

1. 只查找命令行中明确包含 `--user-data-dir=D:\tmp\chrome-cdp-profile` 或 `--user-data-dir="D:\tmp\chrome-cdp-profile"` 的 `chrome.exe` 进程。
2. 先向用户说明将终止这些占用固定采集 profile 的 Chrome 进程；按当前环境权限规则执行终止。
3. 终止后只用同一个固定 profile 重试原命令一次。
4. 如果没有找到占用进程、终止失败或重试失败，停止任务并报告原始错误。
5. 禁止执行宽泛的 `taskkill /IM chrome.exe` 或终止不带该 `--user-data-dir` 的普通 Chrome 进程。

PowerShell 查询与终止示例：

```powershell
$profile = 'D:\tmp\chrome-cdp-profile'
Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
  Where-Object {
    $_.CommandLine -like "*--user-data-dir=$profile*" -or
    $_.CommandLine -like "*--user-data-dir=`"$profile`"*"
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## Browser Rules

1. 脚本必须使用固定 profile 目录 `D:\tmp\chrome-cdp-profile` 启动独立浏览器，不依赖远程调试端口。
2. 启动时使用系统 Chrome，可通过 `INFO_AGG_CHROME_EXECUTABLE` 覆盖可执行文件路径。
3. 默认优先尝试 `playwright-extra` + `puppeteer-extra-plugin-stealth`；若未安装则回退普通 `playwright`。
4. 不自动处理验证码、登录挑战、异常校验页；遇到异常才写入 `### 失败`。
5. 不保存、导出或同步 Cookie、storage state、浏览器 Profile。
6. 脚本需要运行环境可解析 `playwright` 包。
7. Reddit JSON 接口可能返回 403，优先使用 `--user-data-dir` 走系统 Chrome/profile 抓取页面。
8. 固定 profile 被占用时，只允许按「Profile 占用处理」终止明确占用该 profile 的进程并重试一次；禁止在固定 profile 失败后用临时 profile、备用 profile、新建 profile 或默认 Chrome profile 继续执行。

## Output Format

```markdown
## TFT 信息聚合

#### 平台名
- [ ] [标题](内容链接)
  %% source: 模块|平台|来源名|来源入口 %%
```

抓取失败时才追加：

```markdown
### 失败

- 平台名｜[作者名](作者主页链接)｜抓取失败说明。
```

## Notes

- 标题使用页面原文标题。
- 不输出 `### 待处理`；平台分组直接放在 `## TFT 信息聚合` 下。
- 内容行不要写作者、描述、发布时间等额外信息；来源归因写入下一行 Obsidian 注释 `%% source: ... %%`。
- 每条内容或来源项必须使用主待办复选框作为标题行，用于日常处理；来源活跃度通过隐藏 source 注释按日期范围统计。
- 没有失败时不要输出 `### 失败` 或 `暂无失败。`。
- 不输出检索日期。
- 所有 TFT 平台总结都必须参考术语表；英文来源按 `en_to_zh.csv` 统一游戏术语后再总结。
- Tacter 摘要写入 `#### Tacter` 对应标题链接下方，格式为 `> [!summary]- 中文总结`；总结前必须按 `en_to_zh.csv` 统一英文游戏术语。
- Reddit 摘要写入 `## TFT 信息聚合` 下的 `#### Reddit` 平台分组，保留标题链接和缩进的中文总结。
- AI 模块 Reddit 摘要写入 `## AI` 下的 `#### Reddit` 平台分组，保留标题链接和缩进的中文总结。
- AI 模块 X 翻译写入 `## AI` 下的 `#### X` 平台分组，每个来源/博主一项，例如 `- [ ] [Elon Musk](https://x.com/elonmusk)`；同一来源昨天多条 posts 合并在同一个 `> [!quote]- 中文翻译` 可折叠引用块里，用 `---` 分隔；来源项下方输出来源注释，不输出 `第一条`、`第二条` 等头部。
- AI 模块 Linux.do 只写入 `## AI` 下的 `#### Linux.do` 跳转链接，不自动抓取和总结。
- 生活模块 Reddit 摘要写入 `## 生活` 下的 `#### Reddit` 平台分组，保留标题链接和缩进的中文总结。
- 生活模块 X 翻译写入 `## 生活` 下的 `#### X` 平台分组，格式同 AI 模块 X。
