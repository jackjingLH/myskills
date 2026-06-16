---
name: tft-page-planner
description: "当需要把已完成的 TFT 攻略 Markdown 重新规划分页并导出 900x1200 分页 PNG 时使用；默认只改 tft-page 标记；用户明确对首次结果不满意并授权重排时，可在同一父标题内调整子小节或非顺序语义块，并允许段落跨页但不拆图片。"
---

# TFT Markdown 到分页图片

把一篇已完成的 TFT 攻略 Markdown 转成分页 PNG。默认流程是重新规划分页、校验、清空输出目录并导出图片。

## 默认原则

- 调用本 skill 时，总是重新规划分页；不要读取、保留或沿用旧分页方案。
- 默认使用“原文顺序锁定模式”：只允许新增、删除或移动 `<!-- tft-page: N -->`。
- 默认不允许改正文、标题、列表、表格、图片语法、YAML frontmatter、标签或顺序。
- 默认模式评估空白时不追求最后一页填满；最后一页允许大量空白。
- 不再维护 `*.pages.md`，直接在原攻略 Markdown 上写入分页标记。
- 默认信任 `renderPaged.js --plan --write`；不要先手动猜分页点。
- 输出图片固定写入 `D:\ob\JLH\21 TFT\output` 根目录，不按标题、日期或文件名创建子目录。

## 内置脚本

优先使用本 skill 的 wrapper 脚本执行默认流程；以下相对路径均以本 skill 目录为执行目录。分页渲染工具源码、背景图、package 文件和测试都内置在 `scripts/tft-image`。

```powershell
node scripts/run-page-planner.mjs "<攻略.md绝对路径>"
```

非破坏性环境自检：

```powershell
node scripts/run-page-planner.mjs --check-env
```

需要同时输出目标 Markdown 的 diff 时加 `--show-diff`：

```powershell
node scripts/run-page-planner.mjs "<攻略.md绝对路径>" --show-diff
```

脚本会依次完成环境检查、`--plan --write`、`--check`、导出 PNG、再次 `--check`、`git diff --check` 和 PNG 列表输出。默认模式和二阶段重排模式的正文边界仍需按下文要求人工核对 `git diff`。

底层工具目录：

```powershell
scripts/tft-image
```

如果该目录缺少 `node_modules`，只在用户授权后进入该目录运行：

```powershell
npm install
```

## 二阶段重排模式

只有同时满足以下条件，才允许进入二阶段重排模式：

- 已经按默认流程导出过一次图片。
- 用户看过结果后明确表示不满意。
- 用户明确授权“允许重排”“允许调整顺序”“放开排序”或同等含义。

二阶段重排模式下：

- 仍然禁止改写任何正文字符；不允许润色、删减、合并、补充、改标题或改图片语法。
- 父标题是内容归属边界；不得把某个父标题下的内容移动到其他父标题下。例如 `装备选择` 的内容不能移到 `运营节奏` 下。
- 允许在同一父标题内调整子标题小节的顺序。例如 `装备选择` 下的 `金克丝`、`卑尔维斯`、`阿卡丽` 可以按页面空间和阅读效果重排。
- 允许在同一标题小节内部移动非顺序型完整语义块，并重新规划 `tft-page` 标记。
- 完整语义块包括：完整列表项及其缩进子项、完整表格、完整图片块及其说明、完整 callout 块。
- 段落可以跨页截断；允许为了填满页面，把 `tft-page` 标记放入段落内部，让段落前半页显示、后半页续到下一页。
- 图片块及其说明不得拆分；不得让图片跨页截断。
- 表格、列表项、图片说明、callout 块和 YAML frontmatter 不得拆分。
- 不允许移动 YAML frontmatter、主标题、元信息、标签和明确有流程依赖的段落；开局/中期/后期、运营节奏等顺序型内容默认视为有流程依赖，除非用户明确要求调整这些内容的顺序。
- 二阶段应把非尾页尽量填满作为更高优先级。允许把下一个标题补到上一页尾部，但不能只放标题；标题后至少要带一行正文内容，段落被截断也可以。
- 二阶段评估空白时不追求最后两页填满；最后两页允许大量空白，不作为继续重排的主要理由。
- 不需要先给用户输出重排建议；授权后可以直接重排、重新分页、校验并导出图片。
- 完成后必须检查最终结果：`--check` 通过，导出成功，且 `git diff` 中没有正文字符级修改；只能看到同一父标题内的子小节/非顺序语义块移动、段落内 `tft-page` 标记插入或移动，以及分页标记变化。

## 执行前自检

在修改 Markdown 前先确认环境；任一失败都先报告原始输出并停止，不要写入分页标记。

首选执行：

```powershell
node scripts/run-page-planner.mjs --check-env
```

如果 wrapper 脚本不可用，再手动执行以下检查。

在 `scripts/tft-image` 目录执行：

```powershell
node --version
Test-Path ".\renderPaged.js"
Test-Path ".\package.json"
Test-Path ".\node_modules"
```

要求：
- `node --version` 正常输出版本号。
- `renderPaged.js` 存在。
- `package.json` 存在。
- `node_modules` 存在；如果缺失，先报告依赖未安装。只有用户授权安装依赖时，才在 `scripts/tft-image` 目录运行 `npm install`。
- 目标 Markdown 文件存在，且位于 `D:\ob\JLH\21 TFT` 目录内。

## 标准流程

首选执行内置脚本：

```powershell
node scripts/run-page-planner.mjs "<攻略.md绝对路径>"
```

如果需要直接调用底层工具，在 `scripts/tft-image` 目录依次执行：

```powershell
node renderPaged.js "<攻略.md绝对路径>" --plan --write
```

```powershell
node renderPaged.js "<攻略.md绝对路径>" --check
```

```powershell
node renderPaged.js "<攻略.md绝对路径>" --output "D:\ob\JLH\21 TFT\output" --clean-output
```

说明：
- `--plan --write` 会先删除旧 `tft-page` 标记，再按真实渲染高度重新规划并写回。
- `--check` 必须通过后才导出。
- `--clean-output` 必须使用，确保 `output` 根目录只保留本次产物。

## 执行后校验

导出后做完整校验，不要只看命令退出码。

在 `scripts/tft-image` 目录执行：

```powershell
node renderPaged.js "<攻略.md绝对路径>" --check
Get-ChildItem "D:\ob\JLH\21 TFT\output" -Filter *.png | Select-Object -ExpandProperty Name
```

在 `D:\ob\JLH` 目录执行：

```powershell
git diff --check -- "<攻略.md相对路径>"
git diff -- "<攻略.md相对路径>"
```

检查要求：
- `--check` 输出 `Paged markdown check: OK`。
- PNG 文件数量等于最终页数。
- 默认模式下，`git diff` 只允许 `<!-- tft-page: N -->` 的新增、删除或移动。
- 二阶段重排模式下，`git diff` 只允许同一父标题内的子小节/非顺序语义块移动、段落内 `<!-- tft-page: N -->` 插入或移动，以及分页标记变化；不得有正文字符级修改、图片拆分或跨父标题移动。

## 成功标准

- `--check` 输出 `Paged markdown check: OK`。
- 导出命令输出的图片数量等于最终页数。
- PNG 直接位于 `D:\ob\JLH\21 TFT\output` 根目录。
- 默认模式下，`git diff` 中目标 Markdown 只出现 `<!-- tft-page: N -->` 的新增、删除或移动。
- 二阶段重排模式下，`git diff` 中目标 Markdown 只允许出现同一父标题内的子小节/非顺序语义块移动、段落内 `<!-- tft-page: N -->` 插入或移动，以及 `<!-- tft-page: N -->` 的新增、删除或移动；不得出现正文字符级修改、图片拆分或跨父标题移动。
- `git diff --check` 无 whitespace error；CRLF warning 可忽略。

## 异常处理

- 如果 `--plan --write` 失败：报告原始错误和目标 Markdown 路径，停止。
- 如果 `--check` 失败：报告溢出页码、超出像素和 `check-report.json` 路径，停止。
- 如果提示单个内容块超过页面高度：报告脚本给出的 block 编号和高度，停止；不要改正文压缩内容。
- 如果图片加载、路径解析或浏览器启动失败：报告原始错误，停止。
- 如果导出或清空 output 失败：报告原始错误，停止；不要改用其它输出目录。

用户如果只想人工调整分页点，会直接在 Markdown 里移动 `tft-page` 标记并单独调用导图脚本；本 skill 不负责人工微调。用户明确授权二阶段重排时，本 skill 可以直接按二阶段规则重排并导出最终图片。

## 汇报要求

完成后只汇报：
- 攻略路径。
- 最终页数。
- `--check` 是否通过。
- 每页高度和 remaining。
- 导出目录。
- PNG 文件列表。
- 是否使用二阶段重排模式。
- 默认模式：是否确认 Markdown diff 只包含分页标记变化。
- 二阶段重排模式：是否确认 Markdown diff 只包含同一父标题内的子小节/非顺序语义块移动、段落内分页标记插入或移动和分页标记变化，且没有正文字符级修改、图片拆分或跨父标题移动。
