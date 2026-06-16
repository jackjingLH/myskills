import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildClearItems,
  buildCliSource,
  buildRuntimeOptions,
  buildTacterSummaryPrompt,
  BROWSER_SOURCES,
  filterRecentBrowserItems,
  getSourcePageUrl,
  loadEnglishTermMappings,
  normalizeBrowserItem,
  parseRelativeDate,
  renderBrowserDiarySection,
  resolveSystemChromeExecutable,
  upsertBrowserSection,
  writeTacterSummaryDiary,
} from './browser-diary.mjs';

test('getSourcePageUrl uses configured videos page URL before derived videos page', () => {
  assert.equal(
    getSourcePageUrl({
      platform: 'YouTube',
      handle: '@YiIsYordleTFT',
      url: 'https://www.youtube.com/@YiIsYordleTFT/videos',
    }),
    'https://www.youtube.com/@YiIsYordleTFT/videos',
  );

  assert.equal(
    getSourcePageUrl({ platform: 'YouTube', handle: '@LearningTFT' }),
    'https://www.youtube.com/@LearningTFT/videos',
  );
});

test('BROWSER_SOURCES includes configured Tacter creators', () => {
  const tacterSources = BROWSER_SOURCES
    .filter((source) => source.platform === 'Tacter')
    .map((source) => [source.name, source.url]);

  assert.deepEqual(tacterSources, [
    ['TFTtomus', 'https://www.tacter.com/@tfttomus'],
    ['ExTIRIA', 'https://www.tacter.com/@extiria'],
  ]);
});

test('buildCliSource creates an explicit browser source from URL arguments', () => {
  assert.deepEqual(buildCliSource({
    url: 'https://www.youtube.com/@YiIsYordleTFT/videos',
    source: 'Yi Is Yordle TFT',
  }), {
    platform: 'YouTube',
    name: 'Yi Is Yordle TFT',
    handle: '@YiIsYordleTFT',
    url: 'https://www.youtube.com/@YiIsYordleTFT/videos',
  });
});

test('buildRuntimeOptions supports fixed profile directories via user-data-dir', () => {
  const options = buildRuntimeOptions([
    '--date=2026-05-14',
    '--user-data-dir=D:\\tmp\\chrome-cdp-profile',
    '--source=Yi Is Yordle TFT',
    '--url=https://www.youtube.com/@YiIsYordleTFT/videos',
  ]);

  assert.equal(options.today, '2026-05-14');
  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
  assert.equal(options.sources[0].url, 'https://www.youtube.com/@YiIsYordleTFT/videos');
});

test('buildRuntimeOptions supports Tacter summary files', () => {
  const options = buildRuntimeOptions([
    '--source=Tacter',
    '--output-discussion=D:\\tmp\\info-aggregation\\tacter-discussion.json',
    '--summary-file=D:\\tmp\\info-aggregation\\tacter-summary.md',
    '--terms-file=references/terms/en_to_zh.csv',
  ]);

  assert.equal(options.outputDiscussionFile, 'D:\\tmp\\info-aggregation\\tacter-discussion.json');
  assert.equal(options.summaryFile, 'D:\\tmp\\info-aggregation\\tacter-summary.md');
  assert.equal(options.termsFile, 'references/terms/en_to_zh.csv');
});

test('buildRuntimeOptions defaults to the fixed Chrome profile', () => {
  const options = buildRuntimeOptions([]);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
  assert.equal(options.termsFile, path.resolve('references', 'terms', 'en_to_zh.csv'));
});

test('buildRuntimeOptions can select all sources from a platform', () => {
  const options = buildRuntimeOptions(['--source=Tacter']);

  assert.deepEqual(
    options.sources.map((source) => source.name),
    ['TFTtomus', 'ExTIRIA'],
  );
});

test('buildRuntimeOptions keeps legacy profile-dir as a fallback', () => {
  const options = buildRuntimeOptions([
    '--profile-dir=D:\\tmp\\chrome-cdp-profile',
  ]);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
});

test('buildRuntimeOptions rejects non-fixed profile directories', () => {
  assert.throws(
    () => buildRuntimeOptions(['--user-data-dir=D:\\tmp\\info-aggregation-playwright-profile']),
    /必须使用固定目录 D:\\tmp\\chrome-cdp-profile/,
  );
});

test('resolveSystemChromeExecutable prefers the configured executable path', async () => {
  const chosen = await resolveSystemChromeExecutable({
    candidates: ['D:\\custom\\chrome.exe', 'D:\\fallback\\chrome.exe'],
    accessFn: async (candidate) => {
      if (candidate === 'D:\\custom\\chrome.exe') return undefined;
      throw new Error('missing');
    },
  });

  assert.equal(chosen, 'D:\\custom\\chrome.exe');
});

test('resolveSystemChromeExecutable throws when no chrome executable is found', async () => {
  await assert.rejects(
    resolveSystemChromeExecutable({
      candidates: ['D:\\missing\\chrome.exe'],
      accessFn: async () => {
        throw new Error('missing');
      },
    }),
    /未找到系统 Chrome 可执行文件/,
  );
});

test('parseRelativeDate handles English and Chinese recent dates', () => {
  assert.equal(parseRelativeDate('3 days ago', '2026-05-14'), '2026-05-11');
  assert.equal(parseRelativeDate('1 week ago', '2026-05-14'), '2026-05-07');
  assert.equal(parseRelativeDate('6天前', '2026-05-14'), '2026-05-08');
  assert.equal(parseRelativeDate('2周前', '2026-05-14'), '2026-04-30');
  assert.equal(parseRelativeDate('Streamed 4 hours ago', '2026-05-14'), '2026-05-14');
  assert.equal(parseRelativeDate('Updated 53m ago', '2026-05-14'), '2026-05-14');
  assert.equal(parseRelativeDate('Updated 6h ago', '2026-05-14'), '2026-05-14');
  assert.equal(parseRelativeDate('Updated 1d ago', '2026-05-14'), '2026-05-13');
});

test('normalizeBrowserItem converts YouTube card data into diary content item', () => {
  const item = normalizeBrowserItem({
    title: 'Meta Snapshot Patch Guide',
    link: '/watch?v=abc123',
    metadataText: '1,234 views 3 days ago',
  }, {
    platform: 'YouTube',
    name: 'LearningTFT',
    handle: '@LearningTFT',
  }, '2026-05-14');

  assert.deepEqual(item, {
    module: 'TFT',
    platform: 'YouTube',
    author: 'LearningTFT',
    sourceUrl: undefined,
    title: '[Meta Snapshot Patch Guide](https://www.youtube.com/watch?v=abc123)',
    description: 'LearningTFT｜2026-05-11 发布',
    publishedDate: '2026-05-11',
  });
});

test('normalizeBrowserItem converts Tacter card data into diary content item', () => {
  const item = normalizeBrowserItem({
    title: 'Jhin Dark Star  Composition - Set 17 Teamfight Tactics',
    link: '/tft/guides/jhin-dark-star-composition-set-17-teamfight-tactics-3067813d?source_page=game-home',
    metadataText: 'TFTtomus• Updated 8h ago',
  }, {
    platform: 'Tacter',
    name: 'TFTtomus',
    handle: '@tfttomus',
    url: 'https://www.tacter.com/@tfttomus',
  }, '2026-05-14');

  assert.deepEqual(item, {
    module: 'TFT',
    platform: 'Tacter',
    author: 'TFTtomus',
    sourceUrl: 'https://www.tacter.com/@tfttomus',
    title: '[Jhin Dark Star Composition - Set 17 Teamfight Tactics](https://www.tacter.com/tft/guides/jhin-dark-star-composition-set-17-teamfight-tactics-3067813d?source_page=game-home)',
    description: 'TFTtomus｜2026-05-14 发布',
    publishedDate: '2026-05-14',
  });
});

test('loadEnglishTermMappings reads en_to_zh.csv source and target columns', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tacter-terms-'));
  const termsFile = path.join(dir, 'en_to_zh.csv');
  await fs.writeFile(termsFile, 'source,target,tgt_lng\n"Best in Slot","最佳装备","zh-CN"\n"Fast 8","速八","zh-CN"\n', 'utf8');

  const terms = await loadEnglishTermMappings(termsFile);

  assert.deepEqual(terms, [
    { source: 'Best in Slot', target: '最佳装备' },
    { source: 'Fast 8', target: '速八' },
  ]);
});

test('buildTacterSummaryPrompt asks to translate terms before summarizing', () => {
  const prompt = buildTacterSummaryPrompt({
    source: { platform: 'Tacter', name: 'TFTtomus' },
    item: {
      title: '[Jhin Dark Star Composition - Set 17 Teamfight Tactics](https://www.tacter.com/tft/guides/jhin)',
    },
    content: 'Fast 8 and roll down for Jhin. Best in Slot items include AD and Attack Speed.',
    terms: [
      { source: 'Fast 8', target: '速八' },
      { source: 'Best in Slot', target: '最佳装备' },
      { source: 'Attack Speed', target: '攻击速度' },
    ],
  });

  assert.match(prompt, /先根据术语映射/);
  assert.match(prompt, /Fast 8 => 速八/);
  assert.match(prompt, /Best in Slot => 最佳装备/);
  assert.match(prompt, /总结阵容核心/);
});

test('filterRecentBrowserItems keeps only yesterday by default', () => {
  const items = [
    { title: 'today', publishedDate: '2026-05-14' },
    { title: 'yesterday', publishedDate: '2026-05-13' },
    { title: 'two days old', publishedDate: '2026-05-12' },
    { title: 'unknown' },
  ];

  assert.deepEqual(
    filterRecentBrowserItems(items, '2026-05-14').map((item) => item.title),
    ['yesterday'],
  );
});

test('renderBrowserDiarySection writes grouped tasks without author or description columns', () => {
  const section = renderBrowserDiarySection([
    {
      platform: 'YouTube',
      author: 'LearningTFT',
      sourceUrl: 'https://www.youtube.com/@LearningTFT/videos',
      title: '[Meta Snapshot Patch Guide](https://www.youtube.com/watch?v=abc123)',
      description: 'LearningTFT｜2026-05-11 发布',
      publishedDate: '2026-05-11',
    },
  ], '2026-05-14');

  assert.match(section, /#### YouTube/);
  assert.match(section, /- \[ \] \[Meta Snapshot Patch Guide\]\(https:\/\/www\.youtube\.com\/watch\?v=abc123\)/);
  assert.match(section, /%% source: TFT\|YouTube\|LearningTFT\|https:\/\/www\.youtube\.com\/@LearningTFT\/videos %%/);
  assert.doesNotMatch(section, /### 待处理/);
  assert.doesNotMatch(section, /平台｜作者｜标题｜描述/);
  assert.doesNotMatch(section, /LearningTFT｜2026-05-11 发布/);
  assert.doesNotMatch(section, /### 失败/);
  assert.doesNotMatch(section, /检索日期/);
});

test('renderBrowserDiarySection writes optional summaries below tasks', () => {
  const section = renderBrowserDiarySection([
    {
      platform: 'Tacter',
      author: 'TFTtomus',
      title: '[Jhin Dark Star Composition](https://www.tacter.com/tft/guides/jhin)',
      summary: '- 烬作为主C，优先做攻击力装备。\n- 阵容需要 8 级大搜稳住战力。',
      publishedDate: '2026-05-14',
    },
  ], '2026-05-14');

  assert.match(section, /#### Tacter/);
  assert.match(section, /> \[!summary\]- 中文总结/);
  assert.match(section, /> - 烬作为主C，优先做攻击力装备。/);
});

test('upsertBrowserSection replaces browser YouTube rows and preserves other platforms', () => {
  const original = `# Daily\n\n## TFT 信息聚合\n\n### 待处理\n\n#### TFTips\n- [ ] [Comp](https://tftips.app/comps/a)\n\n#### YouTube\n- [ ] old\n\n### 失败\n\n暂无失败。\n\n检索日期：2026-05-13\n\n## Other\n\nkeep`;
  const section = renderBrowserDiarySection([
    {
      platform: 'YouTube',
      author: 'LearningTFT',
      title: '[Meta Snapshot Patch Guide](https://www.youtube.com/watch?v=abc123)',
      description: 'LearningTFT｜2026-05-11 发布',
      publishedDate: '2026-05-11',
    },
  ], '2026-05-14');
  const updated = upsertBrowserSection(original, section, buildClearItems([{ platform: 'YouTube' }]));

  assert.match(updated, /#### TFTips\n- \[ \] \[Comp\]\(https:\/\/tftips\.app\/comps\/a\)/);
  assert.match(updated, /#### YouTube\n- \[ \] \[Meta Snapshot Patch Guide\]\(https:\/\/www\.youtube\.com\/watch\?v=abc123\)/);
  assert.doesNotMatch(updated, /\n- \[ \] old\n/);
  assert.match(updated, /## Other\n\nkeep/);
});

test('upsertBrowserSection preserves existing Tacter summaries when updating YouTube', () => {
  const original = `## TFT 信息聚合

#### Tacter
- [x] [Jhin Dark Star Composition](https://www.tacter.com/tft/guides/jhin)
  %% source: TFT|Tacter|TFTtomus|https://www.tacter.com/@tfttomus %%

> [!summary]- 中文总结
> - 旧摘要需要保留。

#### YouTube
- [ ] old`;
  const section = renderBrowserDiarySection([
    {
      platform: 'YouTube',
      author: 'LearningTFT',
      title: '[Meta Snapshot Patch Guide](https://www.youtube.com/watch?v=abc123)',
      publishedDate: '2026-05-14',
    },
  ], '2026-05-14');
  const updated = upsertBrowserSection(original, section, buildClearItems([{ platform: 'YouTube' }]));

  assert.match(updated, /#### Tacter\n- \[x\] \[Jhin Dark Star Composition\]/);
  assert.match(updated, /> - 旧摘要需要保留。/);
  assert.doesNotMatch(updated, /\n- \[ \] old\n/);
});

test('upsertBrowserSection preserves simplified Reddit rows with subreddit prefix', () => {
  const original = `## TFT 信息聚合

#### Reddit
- [ ] CompetitiveTFT｜[Thresh's Boon](https://www.reddit.com/r/CompetitiveTFT/comments/abc)

> [!summary]- 中文总结
> - Reddit 摘要需要保留。

#### Tacter
- [ ] old`;
  const section = renderBrowserDiarySection([
    {
      platform: 'Tacter',
      author: 'TFTtomus',
      title: '[Jhin Dark Star Composition](https://www.tacter.com/tft/guides/jhin)',
      summary: '- 新 Tacter 摘要。',
      publishedDate: '2026-05-18',
    },
  ], '2026-05-18');
  const updated = upsertBrowserSection(original, section, buildClearItems([{ platform: 'Tacter' }]));

  assert.match(updated, /#### Reddit\n- \[ \] CompetitiveTFT｜\[Thresh's Boon\]/);
  assert.match(updated, /> - Reddit 摘要需要保留。/);
  assert.match(updated, /#### Tacter\n- \[ \] \[Jhin Dark Star Composition\]/);
});

test('writeTacterSummaryDiary writes summaries under Tacter and preserves YouTube', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tacter-summary-diary-'));
  const diaryPath = path.join(diaryDir, '2026-05-18.md');
  await fs.writeFile(diaryPath, '## TFT 信息聚合\n\n#### YouTube\n- [ ] [Video](https://www.youtube.com/watch?v=abc)\n\n#### Tacter\n- [ ] old\n\n## AI\n\nkeep\n', 'utf8');

  const result = await writeTacterSummaryDiary({
    diaryDir,
    today: '2026-05-18',
    discussions: [{
      source: {
        platform: 'Tacter',
        name: 'TFTtomus',
        url: 'https://www.tacter.com/@tfttomus',
      },
      item: {
        platform: 'Tacter',
        author: 'TFTtomus',
        title: '[Jhin Dark Star Composition](https://www.tacter.com/tft/guides/jhin)',
        publishedDate: '2026-05-18',
      },
      content: 'Fast 8 Jhin guide.',
    }],
    summaries: ['- 速八后围绕烬构建阵容。\n- 装备优先攻击力和攻击速度。'],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /#### YouTube\n- \[ \] \[Video\]/);
  assert.match(diary, /#### Tacter\n- \[ \] \[Jhin Dark Star Composition\]/);
  assert.match(diary, /> \[!summary\]- 中文总结/);
  assert.match(diary, /> - 速八后围绕烬构建阵容。/);
  assert.doesNotMatch(diary, /\n- \[ \] old\n/);
  assert.match(diary, /## AI\n\nkeep/);
});
