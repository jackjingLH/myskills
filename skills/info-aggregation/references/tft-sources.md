# TFT Sources

来源整理自：

- `D:\code\TEXTCODE\tftblog-nextjs\scripts\fetch-all.js`
- `D:\code\TEXTCODE\tftblog-nextjs\scripts\migrate-sources.js`

## Source Registry

`启用` 控制默认抓取；`近30天命中`、`最近命中`、`活跃度` 由 Codex 根据日记中的来源注释定期统计更新。

| 启用 | 模块 | 平台 | 来源 | 入口 | 近30天命中 | 最近命中 | 活跃度 | 备注 |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| [x] | TFT | Tacter | TFTtomus | `https://www.tacter.com/@tfttomus` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | TFT | Tacter | ExTIRIA | `https://www.tacter.com/@extiria` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | TFT | Reddit | CompetitiveTFT | `https://www.reddit.com/r/CompetitiveTFT/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [x] | TFT | Reddit | TeamfightTactics | `https://www.reddit.com/r/TeamfightTactics/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [x] | TFT | Reddit | Lunaedge | `https://www.reddit.com/user/Lunaedge/submitted/` | 待统计 | 待统计 | 待统计 | 用户 submitted 时间线；只写昨日发布帖子 |
| [x] | AI | Reddit | vibecoding | `https://www.reddit.com/r/vibecoding/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [x] | AI | Reddit | ArtificialInteligence | `https://www.reddit.com/r/ArtificialInteligence/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [ ] | AI | Reddit | MachineLearning | `https://www.reddit.com/r/MachineLearning/hot/` | 待统计 | 待统计 | 待统计 | 暂不启用 |
| [x] | AI | X | Elon Musk | `https://x.com/elonmusk` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | AI | X | sama | `https://x.com/sama` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | AI | X | karpathy | `https://x.com/karpathy` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | AI | X | AndrewYNg | `https://x.com/AndrewYNg` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | AI | X | lexfridman | `https://x.com/lexfridman` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | AI | Linux.do | 开发调优周榜 | `https://linux.do/c/develop/4/l/top?period=weekly` | 待统计 | 待统计 | 待统计 | 只写跳转入口，不自动总结 |
| [x] | 生活 | Reddit | nutrition | `https://www.reddit.com/r/nutrition/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [x] | 生活 | Reddit | badbreath | `https://www.reddit.com/r/badbreath/hot/` | 待统计 | 待统计 | 待统计 | 口气异味专题；hot 流不保证严格昨日 |
| [x] | 生活 | Reddit | Parenting | `https://www.reddit.com/r/Parenting/hot/` | 待统计 | 待统计 | 待统计 | hot 流不保证严格昨日 |
| [x] | 生活 | X | Mark_Sisson | `https://x.com/Mark_Sisson` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | 生活 | X | foundmyfitness | `https://x.com/foundmyfitness` | 待统计 | 待统计 | 待统计 | 默认启用 |
| [x] | TFT | Tacter | TFTips | `https://www.tacter.com/@tftips` | 待统计 | 待统计 | 待统计 | 默认启用 |

## Platforms

| Platform | 类型 | 来源入口 | 说明 |
| --- | --- | --- | --- |
| YouTube | 视频平台 | 浏览器页面 `https://www.youtube.com/@{handle}/videos` | 英文 TFT 视频频道 |
| Tacter | 攻略平台 | `https://www.tacter.com/@{username}` | TFT 攻略作者 |
| Bilibili | 视频平台 | 待定：浏览器页面采集 | 中文 B 站 UP 主 |
| Douyin | 视频平台 | 待定：浏览器页面采集 | 抖音 TFT 账号；当前配置文件未提供正式账号，仅有测试账号脚本 |
| Reddit | 论坛 | `https://www.reddit.com/r/CompetitiveTFT/`、`https://www.reddit.com/r/TeamfightTactics/` | TFT subreddit hot 第一帖摘要 |
| X | 社交平台 | `https://x.com/{handle}` | AI/生活模块固定博主 posts 翻译 |

## Source Map

### Bilibili

| 作者 | UID | 粉丝备注 |
| --- | --- | --- |
| 林小北Lindo | `18343134` | 186万 |
| GoDlike_神超 | `388063772` | 84.46万 |
| 手刃猫咪 | `262943792` | 15.69万 |
| 兔子解说JokerTu | `14306063` | 待更新 |
| 襄平霸王东 | `37452208` | 待更新 |
| 云顶风向标 | `3546666107931417` | 待更新 |

### Tacter

| 作者 | Username | 描述 |
| --- | --- | --- |
| TFTtomus | `tfttomus` | TFT 阵容与版本攻略作者 |
| TFTips | `tftips` | I create guides |
| ExTIRIA | `extiria` | I play TFT |

### Douyin

`migrate-sources.js` 未包含正式抖音账号。不要臆造抖音作者；只有在本地数据库或用户补充账号后再纳入聚合。

### Reddit

| 社区 | 页面 | 说明 |
| --- | --- | --- |
| CompetitiveTFT | `https://www.reddit.com/r/CompetitiveTFT/` | 每天抓取默认 hot 排序第一条非置顶帖子，读取正文和热门评论，生成中文总结 |
| TeamfightTactics | `https://www.reddit.com/r/TeamfightTactics/` | 每天抓取默认 hot 排序第一条非置顶帖子，读取正文和热门评论，生成中文总结 |

### X

| 模块 | 作者 | 页面 | 说明 |
| --- | --- | --- | --- |
| AI | Elon Musk | `https://x.com/elonmusk` | 抓取昨天 posts，直接翻译为中文后写入 `## AI` 下的 `#### X` |
| AI | sama | `https://x.com/sama` | 同上 |
| AI | karpathy | `https://x.com/karpathy` | 同上 |
| AI | AndrewYNg | `https://x.com/AndrewYNg` | 同上 |
| AI | lexfridman | `https://x.com/lexfridman` | 同上 |
| 生活 | Mark_Sisson | `https://x.com/Mark_Sisson` | 同上 |
| 生活 | foundmyfitness | `https://x.com/foundmyfitness` | 同上 |

## Selection Rules

1. 只从上面的固定来源取候选内容。
2. 默认只选取运行日（Asia/Shanghai）昨天发布或昨天更新的内容；Reddit hot 无法确认日期时只作为当前 hot 快照处理。
3. 同一作者短时间内有多条内容时，最多选 1 条，除非其他平台没有足够候选。
4. 标题保持原文，描述用中文重写。
5. 若来源来自视频平台，描述应包含视频作者和主题；若来源来自文章/阵容平台，描述应包含文章分类或阵容主题。

## Access Strategy

1. 通过 Playwright 使用固定 profile 启动浏览器页面采集固定来源。
2. 如需先登录，先用 Chrome `--user-data-dir="D:\tmp\chrome-cdp-profile"` 打开独立 profile，完成登录后关闭，再运行脚本复用同一目录。
3. YouTube/Tacter 页面提取只采集结构化候选项：标题、链接、页面可见发布时间，并默认只保留昨天内容。
4. Reddit 页面提取结构化帖子数据：标题、链接、正文、评论作者、评论分数、评论正文。
5. X 页面提取结构化 posts：正文、链接、发布时间，并默认只保留昨天内容；优先在主页时间线点击 `Show more`/`显示更多` 展开正文，只有主页正文仍疑似截断时才进入 status 页补正文；AI 只做中文翻译，不做总结。
6. 不把整页 HTML 交给 AI；AI 只处理已抽取的候选列表、帖子正文、评论文本或 X 正文。
