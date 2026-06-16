import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildRuntimeOptions,
  buildXTranslationPrompt,
  DEFAULT_AI_X_SOURCES,
  DEFAULT_LIFE_X_SOURCES,
  DEFAULT_X_SOURCES,
  filterRecentXPosts,
  filterXPostsBySource,
  isXShowMoreText,
  isRecoverableXNavigationError,
  shouldFetchXStatusDetail,
  mergeXPostDetail,
  renderXSection,
  upsertAiXSection,
  upsertLifeXSection,
  writeAiXDiary,
  writeLifeXDiary,
} from './x-diary.mjs';

test('DEFAULT_AI_X_SOURCES includes AI X creators on post pages', () => {
  assert.deepEqual(DEFAULT_AI_X_SOURCES, [
    {
      platform: 'X',
      name: 'Elon Musk',
      handle: 'elonmusk',
      url: 'https://x.com/elonmusk',
    },
    {
      platform: 'X',
      name: 'sama',
      handle: 'sama',
      url: 'https://x.com/sama',
    },
    {
      platform: 'X',
      name: 'karpathy',
      handle: 'karpathy',
      url: 'https://x.com/karpathy',
    },
    {
      platform: 'X',
      name: 'AndrewYNg',
      handle: 'AndrewYNg',
      url: 'https://x.com/AndrewYNg',
    },
    {
      platform: 'X',
      name: 'lexfridman',
      handle: 'lexfridman',
      url: 'https://x.com/lexfridman',
    },
  ]);
  assert.deepEqual(DEFAULT_X_SOURCES, DEFAULT_AI_X_SOURCES);
});

test('DEFAULT_LIFE_X_SOURCES includes life X creators on post pages', () => {
  assert.deepEqual(DEFAULT_LIFE_X_SOURCES.map((source) => [source.name, source.handle, source.url]), [
    ['Mark_Sisson', 'Mark_Sisson', 'https://x.com/Mark_Sisson'],
    ['foundmyfitness', 'foundmyfitness', 'https://x.com/foundmyfitness'],
  ]);
});

test('buildRuntimeOptions defaults to the fixed X browser profile', () => {
  const options = buildRuntimeOptions([]);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
  assert.equal(options.section, 'ai');
});

test('buildRuntimeOptions accepts life section', () => {
  const options = buildRuntimeOptions(['--section=life']);

  assert.equal(options.section, 'life');
});

test('buildRuntimeOptions rejects non-fixed X browser profiles', () => {
  assert.throws(
    () => buildRuntimeOptions(['--profile-dir=D:\\tmp\\other-profile']),
    /必须使用固定目录 D:\\tmp\\chrome-cdp-profile/,
  );
});

test('filterRecentXPosts keeps only yesterday in Shanghai time', () => {
  const posts = filterRecentXPosts([
    {
      text: 'today post',
      url: 'https://x.com/elonmusk/status/1',
      createdAt: '2026-05-19T03:00:00.000Z',
    },
    {
      text: 'yesterday post',
      url: 'https://x.com/elonmusk/status/2',
      createdAt: '2026-05-18T13:00:00.000Z',
    },
    {
      text: 'old post',
      url: 'https://x.com/elonmusk/status/3',
      createdAt: '2026-05-17T12:00:00.000Z',
    },
  ], '2026-05-19');

  assert.deepEqual(posts.map((post) => post.text), ['yesterday post']);
});

test('filterXPostsBySource keeps only posts from the configured handle', () => {
  const posts = filterXPostsBySource([
    {
      text: 'own post',
      url: 'https://x.com/elonmusk/status/1',
      createdAt: '2026-05-18T20:00:00.000Z',
    },
    {
      text: 'repost',
      url: 'https://x.com/OpenRouter/status/2',
      createdAt: '2026-05-18T20:00:00.000Z',
    },
  ], DEFAULT_AI_X_SOURCES[0]);

  assert.deepEqual(posts.map((post) => post.text), ['own post']);
});

test('isXShowMoreText recognizes English and Chinese expand controls', () => {
  assert.equal(isXShowMoreText('Show more'), true);
  assert.equal(isXShowMoreText('显示更多'), true);
  assert.equal(isXShowMoreText('展开'), true);
  assert.equal(isXShowMoreText('Reply'), false);
});

test('isRecoverableXNavigationError recognizes X timeline reload during evaluate', () => {
  assert.equal(
    isRecoverableXNavigationError(new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation')),
    true,
  );
  assert.equal(isRecoverableXNavigationError(new Error('Timeout 30000ms exceeded')), false);
});

test('shouldFetchXStatusDetail only falls back for suspiciously truncated text', () => {
  assert.equal(shouldFetchXStatusDetail({ text: 'This is complete.' }), false);
  assert.equal(shouldFetchXStatusDetail({ text: 'This ends with' }), false);
  assert.equal(shouldFetchXStatusDetail({ text: 'This ends with…' }), true);
  assert.equal(shouldFetchXStatusDetail({ text: 'This ends with x.com/example/…' }), true);
});

test('mergeXPostDetail keeps the longer status page text when list text is truncated', () => {
  const merged = mergeXPostDetail(
    {
      text: 'X has transformed far beyond a traditional social media app with AI video',
      url: 'https://x.com/elonmusk/status/1',
      createdAt: '2026-05-18T20:00:00.000Z',
    },
    {
      text: 'X has transformed far beyond a traditional social media app with AI video, messaging, payments and more.',
      url: 'https://x.com/elonmusk/status/1',
      createdAt: '2026-05-18T20:00:00.000Z',
    },
  );

  assert.equal(merged.text, 'X has transformed far beyond a traditional social media app with AI video, messaging, payments and more.');
});

test('mergeXPostDetail preserves the list page timestamp used for recent filtering', () => {
  const merged = mergeXPostDetail(
    {
      text: 'recent list text',
      url: 'https://x.com/Mark_Sisson/status/1',
      createdAt: '2026-05-18T20:00:00.000Z',
      shanghaiDate: '2026-05-19',
    },
    {
      text: 'recent list text with more detail',
      createdAt: '2026-05-13T20:00:01.000Z',
    },
  );

  assert.equal(merged.createdAt, '2026-05-18T20:00:00.000Z');
  assert.equal(merged.shanghaiDate, '2026-05-19');
});

test('buildXTranslationPrompt asks for direct Chinese translations', () => {
  const prompt = buildXTranslationPrompt({
    discussions: [{
      source: DEFAULT_AI_X_SOURCES[0],
      posts: [
        {
          text: 'Robots will change everything.',
          url: 'https://x.com/elonmusk/status/1',
          createdAt: '2026-05-19T03:00:00.000Z',
        },
      ],
    }],
  });

  assert.match(prompt, /请把 X 平台昨天的 posts/);
  assert.match(prompt, /直接翻译为中文/);
  assert.match(prompt, /不要写总结、点评或折叠 callout/);
  assert.match(prompt, /作者：Elon Musk/);
  assert.match(prompt, /Robots will change everything\./);
});

test('renderXSection writes Elon Musk source and collapsed translation callout', () => {
  const section = renderXSection({
    discussions: [{
      source: DEFAULT_AI_X_SOURCES[0],
      posts: [
        {
          text: 'Robots will change everything.',
          url: 'https://x.com/elonmusk/status/1',
          translation: '机器人会改变一切。',
        },
        {
          text: 'Mars needs more rockets.',
          url: 'https://x.com/elonmusk/status/2',
          translation: '火星需要更多火箭。',
        },
      ],
    }],
  });

  assert.equal(section, [
    '#### X',
    '- [ ] [Elon Musk](https://x.com/elonmusk)',
    '  %% source: AI|X|Elon Musk|https://x.com/elonmusk %%',
    '  > [!quote]- 中文翻译',
    '  > 机器人会改变一切。',
    '  >',
    '  > ---',
    '  >',
    '  > 火星需要更多火箭。',
  ].join('\n'));
  assert.match(section, /\[!quote\]- 中文翻译/);
  assert.doesNotMatch(section, /第一条|第二条/);
});

test('renderXSection writes multiple creators in one X platform block', () => {
  const section = renderXSection({
    discussions: [
      {
        source: DEFAULT_AI_X_SOURCES[1],
        posts: [{
          text: 'AGI note',
          url: 'https://x.com/sama/status/1',
          translation: 'AGI 记录。',
        }],
      },
      {
        source: DEFAULT_AI_X_SOURCES[2],
        posts: [{
          text: 'Coding note',
          url: 'https://x.com/karpathy/status/2',
          translation: '编程记录。',
        }],
      },
    ],
  });

  assert.match(section, /- \[ \] \[sama\]\(https:\/\/x\.com\/sama\)/);
  assert.match(section, /- \[ \] \[karpathy\]\(https:\/\/x\.com\/karpathy\)/);
  assert.match(section, /> AGI 记录。/);
  assert.match(section, /> 编程记录。/);
  assert.match(section, /%% source: AI\|X\|sama\|https:\/\/x\.com\/sama %%/);
});

test('upsertAiXSection inserts X under AI and preserves Reddit and Linux.do', () => {
  const original = '## AI\n\n#### Reddit\nkeep reddit\n\n#### Linux.do\nkeep linux\n\n## 随手记\n\nkeep note';
  const next = upsertAiXSection(original, '#### X\n- [Elon Musk](https://x.com/elonmusk)\n  > translated');

  assert.equal(next, '## AI\n\n#### Reddit\nkeep reddit\n\n#### Linux.do\nkeep linux\n\n#### X\n- [Elon Musk](https://x.com/elonmusk)\n  > translated\n\n## 随手记\n\nkeep note');
});

test('upsertAiXSection replaces only existing X platform block', () => {
  const original = '## AI\n\n#### Reddit\nkeep reddit\n\n#### X\nold x\n\n#### Linux.do\nkeep linux\n\n## 随手记';
  const next = upsertAiXSection(original, '#### X\nnew x');

  assert.equal(next, '## AI\n\n#### Reddit\nkeep reddit\n\n#### X\nnew x\n\n#### Linux.do\nkeep linux\n\n## 随手记');
});

test('upsertLifeXSection inserts X under life and preserves AI section', () => {
  const original = '## AI\n\n#### X\nkeep ai x\n\n## 生活\n\n#### Reddit\nkeep life reddit\n\n## 随手记';
  const next = upsertLifeXSection(original, '#### X\nnew life x');

  assert.equal(next, '## AI\n\n#### X\nkeep ai x\n\n## 生活\n\n#### Reddit\nkeep life reddit\n\n#### X\nnew life x\n\n## 随手记');
});

test('writeAiXDiary writes translated X posts to AI section', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-diary-'));
  const result = await writeAiXDiary({
    diaryDir,
    today: '2026-05-19',
    discussions: [{
      source: DEFAULT_AI_X_SOURCES[0],
      posts: [
        {
          text: 'Robots will change everything.',
          url: 'https://x.com/elonmusk/status/1',
          translation: '机器人会改变一切。',
        },
      ],
    }],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /## AI/);
  assert.match(diary, /#### X/);
  assert.match(diary, /- \[ \] \[Elon Musk\]\(https:\/\/x\.com\/elonmusk\)/);
  assert.match(diary, /  > \[!quote\]- 中文翻译/);
  assert.match(diary, /  > 机器人会改变一切。/);
  assert.doesNotMatch(diary, /第一条|第二条/);
});

test('writeLifeXDiary writes translated X posts to life section', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'life-x-diary-'));
  const result = await writeLifeXDiary({
    diaryDir,
    today: '2026-05-19',
    discussions: [{
      source: DEFAULT_LIFE_X_SOURCES[0],
      posts: [
        {
          text: 'Metabolic health matters.',
          url: 'https://x.com/Mark_Sisson/status/1',
          translation: '代谢健康很重要。',
        },
      ],
    }],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /## 生活/);
  assert.match(diary, /#### X/);
  assert.match(diary, /- \[ \] \[Mark_Sisson\]\(https:\/\/x\.com\/Mark_Sisson\)/);
  assert.match(diary, /%% source: 生活\|X\|Mark_Sisson\|https:\/\/x\.com\/Mark_Sisson %%/);
  assert.match(diary, /  > 代谢健康很重要。/);
});
