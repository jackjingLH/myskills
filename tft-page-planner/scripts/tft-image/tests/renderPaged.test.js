import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildPagedHtml,
  cleanOutputDir,
  measurePages,
  parseCliArgs,
  renderPlanMarkdown,
  splitMarkdownBlocks,
  stripPageMarkers,
} from '../renderPaged.js';

test('parseCliArgs supports check and export options', () => {
  const result = parseCliArgs([
    '../../21 TFT/example.md',
    '--plan',
    '--write',
    '--clean-output',
    '--check',
    '--output',
    '../../21 TFT/output/custom',
    '--base-name',
    'guide',
  ]);

  assert.equal(result.pagedMarkdownPath, '../../21 TFT/example.md');
  assert.equal(result.options.plan, true);
  assert.equal(result.options.writePlan, true);
  assert.equal(result.options.cleanOutput, true);
  assert.equal(result.options.checkOnly, true);
  assert.equal(result.options.outputDir, '../../21 TFT/output/custom');
  assert.equal(result.options.baseName, 'guide');
});

test('parseCliArgs keeps normal render mode as image export', () => {
  const result = parseCliArgs(['guide.md']);

  assert.equal(result.pagedMarkdownPath, 'guide.md');
  assert.equal(result.options.checkOnly, false);
  assert.equal(result.options.plan, false);
  assert.equal(result.options.cleanOutput, false);
});

test('parseCliArgs rejects removed preview option', () => {
  assert.throws(
    () => parseCliArgs(['guide.md', '--preview']),
    /Unknown option: --preview/
  );
});

test('measurePages uses rendered content height instead of page min-height', async () => {
  const page = {
    $$eval(selector, callback) {
      assert.equal(selector, '.tft-page');
      const pageElement = {
        dataset: { page: '1' },
        getBoundingClientRect: () => ({ top: 10, bottom: 1210 }),
        querySelectorAll: () => [
          {
            getBoundingClientRect: () => ({ top: 20, bottom: 410 }),
          },
          {
            getBoundingClientRect: () => ({ top: 430, bottom: 760 }),
          },
        ],
      };
      const previousWindow = globalThis.window;
      globalThis.window = {
        getComputedStyle: (element) => ({
          marginBottom: element.getBoundingClientRect().bottom === 760 ? '24px' : '0px',
        }),
      };
      try {
        return callback([pageElement]);
      } finally {
        globalThis.window = previousWindow;
      }
    },
  };

  const measurements = await measurePages(page);

  assert.deepEqual(measurements, [
    { page: 1, height: 774 },
  ]);
});

test('stripPageMarkers removes old markers while preserving frontmatter', () => {
  const markdown = `---
tags:
  - TFT
---
<!-- tft-page: 1 -->
# 标题

<!-- tft-page: 2 -->
## 运营
`;

  const result = stripPageMarkers(markdown);

  assert.match(result.frontmatterRaw, /^---\ntags:/);
  assert.equal(result.body, '# 标题\n\n## 运营\n');
});

test('splitMarkdownBlocks keeps safe break units for headings, list items, and tables', () => {
  const blocks = splitMarkdownBlocks(`# 标题

## 概要

- 条目 A
- 条目 B

| A | B |
| --- | --- |
| 1 | 2 |
`);

  assert.deepEqual(
    blocks.map((block) => block.kind),
    ['heading', 'heading', 'list-item', 'list-item', 'table']
  );
});

test('renderPlanMarkdown writes sequential page markers without changing block text', () => {
  const blocks = splitMarkdownBlocks(`# 标题

第一段。

## 运营

第二段。
`);

  const markdown = renderPlanMarkdown({
    frontmatterRaw: '',
    blocks,
    breaks: [2, blocks.length],
  });

  assert.match(markdown, /^<!-- tft-page: 1 -->\n\n# 标题/);
  assert.match(markdown, /<!-- tft-page: 2 -->\n\n## 运营/);
  assert.match(markdown, /第二段。\n$/);
});

test('buildPagedHtml gives h3 a neon clipped-corner tag style distinct from h2 bars', () => {
  const html = buildPagedHtml({
    frontmatter: '',
    pages: [
      {
        number: 1,
        body: `# 标题

## 装备选择

### 维克托

装备说明。
`,
      },
    ],
  }, process.cwd());

  assert.match(html, /<h3>维克托<\/h3>/);
  const h3Style = html.match(/h3\s*{(?<style>[\s\S]*?)\n  }/)?.groups?.style || '';
  assert.match(h3Style, /display:\s*inline-flex;/);
  assert.match(h3Style, /font-size:\s*32px;/);
  assert.match(h3Style, /line-height:\s*1\.15;/);
  assert.match(h3Style, /color:\s*var\(--aurora-green\);/);
  assert.match(h3Style, /background:\s*linear-gradient\(135deg,/);
  assert.match(h3Style, /border:\s*1px solid rgba\(177, 255, 145, 0\.56\);/);
  assert.match(h3Style, /clip-path:\s*polygon\(/);
  assert.match(h3Style, /box-shadow:/);
  assert.doesNotMatch(h3Style, /text-decoration-line:\s*underline;/);
  assert.doesNotMatch(h3Style, /border-radius:/);
  assert.doesNotMatch(h3Style, /width:\s*100%;/);
});

test('buildPagedHtml removes xiaohongshu hashtags appended to the source line', () => {
  const html = buildPagedHtml({
    frontmatter: '',
    pages: [
      {
        number: 1,
        body: `# 测试标题

标签：新手 / 稳定上分
封面：

## 概要

正文

来源：tftips #金铲铲新手教学 #金铲铲攻略 #金铲铲之战 #娜美 #锐雯 #慎 #太空律动 #太空律动纹章 #珠光护手 #纳什之牙
`,
      },
    ],
  }, process.cwd());

  assert.match(html, /来源：tftips/);
  assert.doesNotMatch(html, /#金铲铲新手教学/);
});

test('cleanOutputDir removes directory contents but keeps the output directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tft-clean-output-'));
  const nested = path.join(dir, 'nested');
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(dir, 'old.png'), 'old');
  fs.writeFileSync(path.join(nested, 'old.txt'), 'old');

  cleanOutputDir(dir);

  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
