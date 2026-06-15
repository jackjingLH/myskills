---
name: tft-guide-writer
description: 当需要把中文、英文或日文 TFT 原稿整理、翻译或改写成可发布的中文格式化攻略时使用，包括中文语音转文字、OCR、直播笔记、粗略草稿、英文或日文攻略、Patch Notes 和版本更新公告；用户提到 guide-writer、normalize-guide、translate-guide 或 /translate-guide 时也使用。
---

# TFT 攻略成稿入口

把单篇 TFT 原稿处理成可发布的中文攻略 Markdown。该 skill 负责成稿前处理；分页导图使用 `tft-page-planner`。

## 路由

每次任务先判断源语言和产物类型，再读取对应 workflow。不要同时执行两个 workflow；混合语种原稿按主体语言选择，少量术语用原文保留并在回复中说明。

| 场景 | 必读文件 |
| --- | --- |
| 中文语音转文字、OCR、直播笔记、粗略中文草稿 | `workflows/normalize.md` |
| 英文或日文原稿、英文 Patch Notes、日文攻略 | `workflows/translate.md` |

两个 workflow 都必须读取：

- `references/guide-common.md`
- 如果产物是攻略笔记，继续读取 `references/guide-writing-style.md`

术语表读取本 skill 内置 CSV；优先用查词脚本检索，必要时再直接打开 CSV。脚本路径相对本 skill 目录：

```powershell
node scripts/lookup-terms.mjs "<术语>" --table all
```

- 中文术语校验：`references/terms/zh_terms.csv`
- 中文 OCR/语音误识别：`references/terms/误识别映射表.csv`
- 英文映射：`references/terms/en_to_zh.csv`
- 日文映射：`references/terms/jp_to_zh.csv`

## 共同原则

- 只处理用户当前提供或明确指定的单篇原稿。
- 不主动读取同题旧稿、本地素材目录或历史整理结果来补内容。
- 可以按信息类型重排结构和语序，但不得新增原稿没有的战术内容、数值、克制关系或总结型章节。
- 输出干净的中文攻略 Markdown；除非用户明确要求，不输出双语对照或处理报告。
- 回复中只简要说明关键术语选择、重要修正和仍需确认的点。
