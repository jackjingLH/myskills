# 英文和日文原稿翻译 Workflow

只处理英文或日文主体原稿。中文语音稿、OCR 或粗略中文笔记改用 `workflows/normalize.md`。

## 必读引用

翻译前先读取：

- `references/guide-common.md`
- 如果产物是攻略笔记，继续读取 `references/guide-writing-style.md`
- 英文原稿读取 `references/terms/en_to_zh.csv`
- 日文原稿读取 `references/terms/jp_to_zh.csv`
- 最终中文术语校验读取 `references/terms/zh_terms.csv`

可先用脚本检索术语：

```powershell
node "D:\OB\JLH\21 TFT\skills\tft-guide-writer\scripts\lookup-terms.mjs" "<源语术语或中文译名>" --table all
```

## 职责

- 将英文或日文 TFT 原稿翻译为可发布的中文攻略。
- 负责跨语种术语映射、中文译名统一和译文自然化整理。
- 攻略格式、元数据、命名、图片和内容边界统一遵循 `references/guide-common.md`。

## 工作流程

1. 判断源语言是英文还是日文。
2. 读取对应语种的术语映射表。
3. 翻译为简体中文，并统一 TFT 专有名词。
4. 必要时改写句子，使最终内容像中文攻略，而不是直译稿。
5. 用 `zh_terms.csv` 校验最终中文术语。
6. 输出到文档前，按 `references/guide-common.md` 做正文自然化检查。
7. 按 `references/guide-common.md` 输出格式化攻略；如果用户要求写入文件，再按其中的路径与命名规则保存。

## 翻译规则

- 目标语言为简体中文。
- 先按源语种术语表翻译，再用 `zh_terms.csv` 校验最终中文名称。
- 原文如果只是清单、短句或碎片内容，可以重排结构和语序，但不要做直译式拼接。
- 语言要自然、清晰、适合发布；优先整理成适合直接发布的中文段落表达。
- 首次翻译按原文信息密度输出，不主动精简、扩写或总结；用户要求二次优化时再做压缩、重组或总结。
- 可以为了中文阅读顺序调整分类和标题，但不要新增原文没有的信息型章节、总结章节或重复性归纳。
- 原文只有少量标题时，默认保持相近的章节数量；只有原文信息天然分散、合并会影响理解时，才拆分章节。

## 输出

- 输出干净的中文攻略 Markdown，不输出双语对照报告。
- 最终结构和字段完全遵循 `references/guide-common.md`。
- 除非用户明确要求，不要把原文放进最终攻略。
- 回复中简要说明源语言、关键术语选择和不确定术语。
