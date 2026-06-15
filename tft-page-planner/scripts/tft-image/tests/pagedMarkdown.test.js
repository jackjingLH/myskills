import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePagedMarkdown,
  summarizePage,
  validateMeasuredPages,
} from '../pagedMarkdown.js';

test('splits paged markdown by explicit page markers without rewriting body content', () => {
  const markdown = `---
tags:
  - TFT
---
<!-- tft-page: 1 type=cover -->
# 测试标题

第一段原文。

<!-- tft-page: 2 -->
## 运营

- 原文列表 A
- 原文列表 B
`;

  const result = parsePagedMarkdown(markdown);

  assert.equal(result.frontmatter.trim(), 'tags:\n  - TFT');
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages[0].number, 1);
  assert.equal(result.pages[0].attrs.type, 'cover');
  assert.equal(result.pages[0].body, '# 测试标题\n\n第一段原文。');
  assert.equal(result.pages[1].body, '## 运营\n\n- 原文列表 A\n- 原文列表 B');
});

test('rejects paged markdown with non-sequential page markers', () => {
  const markdown = `<!-- tft-page: 1 -->
# 第一页

<!-- tft-page: 3 -->
## 第三页
`;

  assert.throws(
    () => parsePagedMarkdown(markdown),
    /Expected page marker 2 but found 3/
  );
});

test('summarizes a page using its first heading and tail text', () => {
  const page = {
    number: 4,
    body: `## 4-2 后运营

这里是第一段。

## 变阵选择

这里是结尾。`,
  };

  const summary = summarizePage(page);

  assert.equal(summary.heading, '## 4-2 后运营');
  assert.equal(summary.tail, '这里是结尾。');
});

test('validates measured page heights and reports overflow amount', () => {
  const pages = [
    { number: 1, body: '# 封面' },
    { number: 2, body: '## 运营\n\n内容' },
  ];
  const report = validateMeasuredPages(pages, [
    { page: 1, height: 1180 },
    { page: 2, height: 1378 },
  ], 1200);

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.pages.map((page) => ({
      page: page.page,
      height: page.height,
      status: page.status,
      overflow: page.overflow,
      remaining: page.remaining,
    })),
    [
      { page: 1, height: 1180, status: 'ok', overflow: 0, remaining: 20 },
      { page: 2, height: 1378, status: 'overflow', overflow: 178, remaining: 0 },
    ]
  );
  assert.equal(report.pages[1].heading, '## 运营');
});
