# 中文原稿整理 Workflow

只处理中文原稿。英文或日文主体内容改用 `workflows/translate.md`。

## 必读引用

处理前先读取：

- `references/guide-common.md`
- 如果产物是攻略笔记，继续读取 `references/guide-writing-style.md`
- `references/terms/zh_terms.csv`
- `references/terms/误识别映射表.csv`

可先用脚本检索术语：

```powershell
node "D:\OB\JLH\21 TFT\skills\tft-guide-writer\scripts\lookup-terms.mjs" "<术语或误识别文本>" --table all
```

## 职责

- 将中文语音稿、OCR 稿、直播笔记和粗略草稿整理为可发布的中文攻略。
- 负责中文术语校正、误识别修正、口语转书面语和结构重排。
- 攻略格式、元数据、命名、图片和内容边界统一遵循 `references/guide-common.md`。

## 工作流程

1. 判断原稿类型：语音转文字、OCR、粗略笔记，或已经有结构的草稿。
2. 根据中文术语表和误识别映射表修正 TFT 术语。
3. 修正常见语音识别错误、OCR 错字和社区黑话。
4. 将口语化表达整理为简洁的书面攻略语言，清理填充词和重复转场。
5. 在不补写新内容的前提下重排结构和语序。
6. 输出到文档前，按 `references/guide-common.md` 做正文自然化检查。
7. 按 `references/guide-common.md` 输出格式化攻略；如果用户要求写入文件，再按其中的路径与命名规则保存。

## 中文整理规则

- 校正英雄、装备、羁绊、强化符文、阶段、游戏机制等术语。
- 修正常见语音识别错误、同音误识别、OCR 错字和社区黑话。
- 删除“嗯”“啊”“那个”等填充词和重复转场，保留有用的战术判断。
- 原稿如果只是清单、短句或碎片笔记，可以重排结构和语序，但不能借整理之名补写新内容。

## 输出

- 输出格式化后的中文攻略 Markdown，不输出处理报告。
- 最终结构和字段完全遵循 `references/guide-common.md`。
- 回复中简要说明重要修正和仍需确认的点。
