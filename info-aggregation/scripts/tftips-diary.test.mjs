import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  filterRecentComps,
  parseComps,
  renderDiarySection,
  upsertSection,
  writeTftipsDiary,
} from './tftips-diary.mjs';

const sampleHtml = `
<section>
  <div class="bg-tier-s"></div>
  <a href="/comps/t-hex">
    <h3>T-Hex Reroll</h3>
    <img src="/champ/sm/annie.png" />
    <div class="inline-flex rounded-full border">リロールLv6</div>
    <div class="inline-flex rounded-full border">初心者にオススメ</div>
    <div>Updated: <!-- -->2026.5.14</div>
  </a>
  <a href="/comps/old-comp">
    <h3>Old Comp</h3>
    <div class="inline-flex rounded-full border">Fast 8</div>
    <div>Updated: 2026.5.12</div>
  </a>
</section>
<section>
  <div class="bg-tier-a"></div>
  <a href="/comps/yesterday">
    <h3>Yesterday Comp</h3>
    <div class="inline-flex rounded-full border">Tempo</div>
    <div>Updated: 2026.5.13</div>
  </a>
</section>
`;

test('parseComps extracts TFTips cards with tier, link, tags, and update date', () => {
  const comps = parseComps(sampleHtml);

  assert.equal(comps.length, 3);
  assert.deepEqual(comps[0], {
    id: 'TFTips-t-hex',
    title: 'T-Hex Reroll',
    description: 'リロールLv6 / 初心者にオススメ',
    link: 'https://tftips.app/comps/t-hex',
    thumbnail: '/champ/md/annie.png',
    platform: 'TFTips',
    author: 'TFTips',
    category: 'S',
    updatedDate: '2026-05-14',
  });
});

test('filterRecentComps keeps only yesterday', () => {
  const comps = parseComps(sampleHtml);
  const recent = filterRecentComps(comps, '2026-05-14');

  assert.deepEqual(
    recent.map((comp) => comp.title),
    ['Yesterday Comp'],
  );
});

test('renderDiarySection formats TFTips items in the shared TFT table', () => {
  const recent = filterRecentComps(parseComps(sampleHtml), '2026-05-14');
  const section = renderDiarySection(recent, '2026-05-14');

  assert.match(section, /^## TFT 信息聚合/m);
  assert.doesNotMatch(section, /### 待处理/);
  assert.match(section, /#### TFTips/);
  assert.match(section, /- \[ \] \[Yesterday Comp\]\(https:\/\/tftips\.app\/comps\/yesterday\)/);
  assert.doesNotMatch(section, /### 失败/);
  assert.doesNotMatch(section, /平台｜作者｜标题｜描述/);
  assert.doesNotMatch(section, /\[TFTips\]\(https:\/\/tftips\.app\/comps\)｜/);
  assert.doesNotMatch(section, /\n  链接：/);
  assert.doesNotMatch(section, /描述：/);
  assert.doesNotMatch(section, /リロールLv6 \/ 初心者にオススメ/);
  assert.doesNotMatch(section, /检索日期/);
});

test('renderDiarySection does not record status when TFTips has no updates', () => {
  const section = renderDiarySection([], '2026-05-14');

  assert.match(section, /^## TFT 信息聚合\n\n暂无待处理内容。$/);
  assert.doesNotMatch(section, /### 待处理/);
  assert.doesNotMatch(section, /### 失败/);
  assert.doesNotMatch(section, /暂无失败/);
  assert.doesNotMatch(section, /检索日期/);
  assert.doesNotMatch(section, /TFTips 没有更新/);
  assert.doesNotMatch(section, /- \[ \] TFTips/);
});

test('upsertSection replaces only TFTips rows in the shared TFT section', () => {
  const original = `# Daily\n\n## TFT 信息聚合\n\n### 待处理\n\n平台｜作者｜标题｜描述\n- [ ] YouTube｜LearningTFT｜[Video](https://youtube.com/watch?v=1)｜keep\n- [ ] TFTips｜TFTips｜old｜replace\n\n### 失败\n\n- TFTips｜TFTips｜old status\n\n检索日期：2026-05-13\n\n## Other\n\nkeep`;
  const nextSection = renderDiarySection(filterRecentComps(parseComps(sampleHtml), '2026-05-14'), '2026-05-14');
  const updated = upsertSection(original, nextSection);

  assert.match(updated, /#### YouTube\n- \[ \] \[Video\]/);
  assert.match(updated, /#### TFTips\n- \[ \] \[Yesterday Comp\]\(https:\/\/tftips\.app\/comps\/yesterday\)/);
  assert.doesNotMatch(updated, /replace/);
  assert.doesNotMatch(updated, /old status/);
  assert.match(updated, /## Other\n\nkeep/);
});

test('upsertSection removes stale TFTips status when there are no updates', () => {
  const original = `# Daily\n\n## TFT 信息聚合\n\n### 待处理\n\n平台｜作者｜标题｜描述\n- [ ] YouTube｜LearningTFT｜[Video](https://youtube.com/watch?v=1)｜keep\n- [ ] TFTips｜TFTips｜old｜replace\n\n### 失败\n\n- TFTips｜[TFTips](https://tftips.app/comps)｜2026-05-14 检查今天/昨天，TFTips 没有更新。\n\n检索日期：2026-05-13\n\n## Other\n\nkeep`;
  const nextSection = renderDiarySection([], '2026-05-14');
  const updated = upsertSection(original, nextSection);

  assert.match(updated, /#### YouTube\n- \[ \] \[Video\]/);
  assert.doesNotMatch(updated, /TFTips 没有更新/);
  assert.doesNotMatch(updated, /TFTips｜TFTips｜old/);
  assert.doesNotMatch(updated, /### 失败/);
  assert.doesNotMatch(updated, /暂无失败/);
  assert.doesNotMatch(updated, /检索日期/);
});

test('writeTftipsDiary records fetch failure without no-update status', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tftips-diary-'));
  const result = await writeTftipsDiary({
    diaryDir,
    today: '2026-05-14',
    fetchHtmlFn: async () => {
      throw new Error('HTTP 500');
    },
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.equal(result.count, 0);
  assert.match(diary, /## TFT 信息聚合\n\n暂无待处理内容。\n\n### 失败/);
  assert.doesNotMatch(diary, /### 待处理/);
  assert.match(diary, /### 失败\n\n- TFTips｜\[TFTips\]\(https:\/\/tftips\.app\/comps\)｜2026-05-14 检查昨天，TFTips 获取失败：HTTP 500，未确认是否有更新。/);
  assert.doesNotMatch(diary, /没有更新/);
});

test('writeTftipsDiary creates a missing diary from the daily template', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tftips-diary-'));
  const templateDir = path.join(diaryDir, '模板');
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(
    path.join(templateDir, '日记.md'),
    '# {{date}}\n\n## TFT 信息聚合\n\n暂无待处理内容。\n\n## AI\n\n## 随手记',
    'utf8',
  );

  const result = await writeTftipsDiary({
    diaryDir,
    today: '2026-05-14',
    fetchHtmlFn: async () => sampleHtml,
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /^# 2026-05-14/m);
  assert.match(diary, /## TFT 信息聚合/);
  assert.doesNotMatch(diary, /### 待处理/);
  assert.match(diary, /#### TFTips\n- \[ \] \[Yesterday Comp\]/);
  assert.doesNotMatch(diary, /### 失败/);
  assert.doesNotMatch(diary, /检索日期/);
  assert.match(diary, /## AI/);
  assert.match(diary, /## 随手记/);
});
