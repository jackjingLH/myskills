import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildRuntimeOptions,
  buildRedditPostFromElement,
  buildRedditSummaryPrompt,
  collectRedditDiscussions,
  DEFAULT_AI_REDDIT_SOURCES,
  DEFAULT_LIFE_REDDIT_SOURCES,
  DEFAULT_REDDIT_SOURCES,
  ensureAiLinuxDoLink,
  extractCommentItems,
  extractTopHotPost,
  extractUserSubmittedPosts,
  loadTermMappings,
  renderRedditSection,
  upsertAiRedditSection,
  upsertLifeRedditSection,
  upsertRedditSection,
  writeAiRedditDiary,
  writeLifeRedditDiary,
  writeRedditDiary,
} from './reddit-diary.mjs';

test('DEFAULT_REDDIT_SOURCES includes both TFT subreddits', () => {
  assert.deepEqual(
    DEFAULT_REDDIT_SOURCES.map((source) => [source.name, source.url]),
    [
      ['CompetitiveTFT', 'https://www.reddit.com/r/CompetitiveTFT/hot/'],
      ['TeamfightTactics', 'https://www.reddit.com/r/TeamfightTactics/hot/'],
      ['Lunaedge', 'https://www.reddit.com/user/Lunaedge/submitted/'],
    ],
  );
});

test('DEFAULT_AI_REDDIT_SOURCES includes AI subreddits', () => {
  assert.deepEqual(
    DEFAULT_AI_REDDIT_SOURCES.map((source) => [source.name, source.url]),
    [
      ['vibecoding', 'https://www.reddit.com/r/vibecoding/hot/'],
      ['MachineLearning', 'https://www.reddit.com/r/MachineLearning/hot/'],
    ],
  );
});

test('DEFAULT_LIFE_REDDIT_SOURCES includes life subreddits', () => {
  assert.deepEqual(
    DEFAULT_LIFE_REDDIT_SOURCES.map((source) => [source.name, source.url]),
    [
      ['nutrition', 'https://www.reddit.com/r/nutrition/hot/'],
      ['badbreath', 'https://www.reddit.com/r/badbreath/hot/'],
      ['Parenting', 'https://www.reddit.com/r/Parenting/hot/'],
    ],
  );
});

test('buildRuntimeOptions enables browser collection with user-data-dir', () => {
  const options = buildRuntimeOptions([
    '--user-data-dir=D:\\tmp\\chrome-cdp-profile',
    '--date=2026-05-15',
    '--output-discussion=D:\\tmp\\reddit-discussion.json',
  ]);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
  assert.equal(options.today, '2026-05-15');
  assert.equal(options.outputDiscussionFile, 'D:\\tmp\\reddit-discussion.json');
});

test('buildRuntimeOptions accepts profile-dir as a user-data-dir alias', () => {
  const options = buildRuntimeOptions(['--profile-dir=D:\\tmp\\chrome-cdp-profile']);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
});

test('buildRuntimeOptions defaults to the fixed reddit browser profile', () => {
  const options = buildRuntimeOptions([]);

  assert.equal(options.profileDir, 'D:\\tmp\\chrome-cdp-profile');
  assert.equal(options.termsDir, path.resolve('references', 'terms'));
});

test('buildRuntimeOptions rejects non-fixed reddit browser profiles', () => {
  assert.throws(
    () => buildRuntimeOptions(['--profile-dir=D:\\tmp\\other-profile']),
    /必须使用固定目录 D:\\tmp\\chrome-cdp-profile/,
  );
});

test('buildRedditPostFromElement prefers comments permalink over media content link', () => {
  const post = buildRedditPostFromElement({
    title: "Kai'Sa shooting 500dmg nukes",
    contentHref: 'https://i.redd.it/9ez7v4qe5c0h1.jpeg',
    commentsHref: '/r/TeamfightTactics/comments/abc/kaisa_shooting_500dmg_nukes/',
    text: "Kai'Sa shooting 500dmg nukes u/tttje009 Gameplay",
  });

  assert.deepEqual(post, {
    title: "Kai'Sa shooting 500dmg nukes",
    url: 'https://www.reddit.com/r/TeamfightTactics/comments/abc/kaisa_shooting_500dmg_nukes/',
    content: "Kai'Sa shooting 500dmg nukes u/tttje009 Gameplay",
    author: '',
    score: 0,
    commentCount: 0,
    createdUtc: 0,
  });
});

test('extractTopHotPost selects the first hot post with title and content', () => {
  const listing = {
    data: {
      children: [
        {
          data: {
            id: 'abc',
            title: 'Patch 17.3 meta discussion',
            permalink: '/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
            url: 'https://www.reddit.com/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
            selftext: 'What comps are working after the patch?',
            author: 'player1',
            score: 321,
            num_comments: 42,
            created_utc: 1778800000,
          },
        },
      ],
    },
  };

  assert.deepEqual(extractTopHotPost(listing), {
    id: 'abc',
    title: 'Patch 17.3 meta discussion',
    url: 'https://www.reddit.com/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
    content: 'What comps are working after the patch?',
    author: 'player1',
    score: 321,
    commentCount: 42,
    createdUtc: 1778800000,
  });
});

test('extractUserSubmittedPosts keeps only yesterday posts in Shanghai time', () => {
  const listing = {
    data: {
      children: [
        {
          kind: 't3',
          data: {
            id: 'yesterday',
            title: 'Yesterday submitted guide',
            permalink: '/user/Lunaedge/comments/yesterday/yesterday_submitted_guide/',
            selftext: 'Useful details.',
            author: 'Lunaedge',
            score: 12,
            num_comments: 3,
            created_utc: Date.parse('2026-05-17T16:30:00.000Z') / 1000,
          },
        },
        {
          kind: 't3',
          data: {
            id: 'today',
            title: 'Today submitted guide',
            permalink: '/user/Lunaedge/comments/today/today_submitted_guide/',
            created_utc: Date.parse('2026-05-18T16:30:00.000Z') / 1000,
          },
        },
      ],
    },
  };

  assert.deepEqual(extractUserSubmittedPosts(listing, { today: '2026-05-19' }), [
    {
      id: 'yesterday',
      title: 'Yesterday submitted guide',
      url: 'https://www.reddit.com/user/Lunaedge/comments/yesterday/yesterday_submitted_guide/',
      content: 'Useful details.',
      author: 'Lunaedge',
      score: 12,
      commentCount: 3,
      createdUtc: Date.parse('2026-05-17T16:30:00.000Z') / 1000,
      publishedDate: '2026-05-18',
    },
  ]);
});

test('collectRedditDiscussions expands user submitted posts into rows', async () => {
  const source = DEFAULT_REDDIT_SOURCES.find((item) => item.name === 'Lunaedge');
  const discussions = await collectRedditDiscussions({
    today: '2026-05-19',
    sources: [source],
    fetchJsonFn: async () => ({
      data: {
        children: [
          {
            kind: 't3',
            data: {
              id: 'abc',
              title: 'Yesterday submitted guide',
              permalink: '/user/Lunaedge/comments/abc/yesterday_submitted_guide/',
              author: 'Lunaedge',
              created_utc: Date.parse('2026-05-18T01:00:00.000Z') / 1000,
            },
          },
          {
            kind: 't3',
            data: {
              id: 'old',
              title: 'Old submitted guide',
              permalink: '/user/Lunaedge/comments/old/old_submitted_guide/',
              author: 'Lunaedge',
              created_utc: Date.parse('2026-05-16T01:00:00.000Z') / 1000,
            },
          },
        ],
      },
    }),
  });

  assert.equal(discussions.length, 1);
  assert.equal(discussions[0].source.name, 'Lunaedge');
  assert.equal(discussions[0].post.title, 'Yesterday submitted guide');
  assert.deepEqual(discussions[0].comments, []);
});

test('extractCommentItems flattens top-level comments and skips deleted text', () => {
  const commentsListing = [
    {},
    {
      data: {
        children: [
          {
            kind: 't1',
            data: {
              body: 'Fast 8 boards feel much stronger now.',
              author: 'coach',
              score: 25,
              created_utc: 1778801000,
              replies: {
                data: {
                  children: [
                    {
                      kind: 't1',
                      data: {
                        body: 'Agree, but reroll is still playable.',
                        author: 'reply-user',
                        score: 7,
                        created_utc: 1778802000,
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            kind: 't1',
            data: {
              body: '[deleted]',
              author: '[deleted]',
              score: 1,
              created_utc: 1778803000,
            },
          },
        ],
      },
    },
  ];

  assert.deepEqual(extractCommentItems(commentsListing, { limit: 5 }), [
    {
      author: 'coach',
      body: 'Fast 8 boards feel much stronger now.',
      score: 25,
      createdUtc: 1778801000,
      depth: 0,
    },
    {
      author: 'reply-user',
      body: 'Agree, but reroll is still playable.',
      score: 7,
      createdUtc: 1778802000,
      depth: 1,
    },
  ]);
});

test('loadTermMappings reads source-target term pairs from csv files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reddit-terms-'));
  await fs.writeFile(path.join(dir, 'en_to_zh.csv'), 'source,target,tgt_lng\n"Fast 8","速八","zh-CN"\n"reroll","赌狗","zh-CN"\n', 'utf8');
  await fs.writeFile(path.join(dir, 'zh_terms.csv'), '术语\n强化符文\n', 'utf8');

  const terms = await loadTermMappings(dir);

  assert.deepEqual(terms.slice(0, 3), [
    { source: 'Fast 8', target: '速八' },
    { source: 'reroll', target: '赌狗' },
    { source: '强化符文', target: '强化符文' },
  ]);
});

test('buildRedditSummaryPrompt includes post, comments, and relevant terms', () => {
  const prompt = buildRedditSummaryPrompt({
    post: {
      title: 'Patch 17.3 meta discussion',
      url: 'https://www.reddit.com/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
      content: 'Fast 8 or reroll?',
    },
    source: DEFAULT_REDDIT_SOURCES[0],
    comments: [
      { author: 'coach', score: 25, body: 'Fast 8 boards feel stronger than reroll.' },
    ],
    terms: [
      { source: 'Fast 8', target: '速八' },
      { source: 'reroll', target: '赌狗' },
      { source: 'unrelated', target: '无关' },
    ],
  });

  assert.match(prompt, /Patch 17\.3 meta discussion/);
  assert.match(prompt, /Fast 8 => 速八/);
  assert.match(prompt, /reroll => 赌狗/);
  assert.doesNotMatch(prompt, /unrelated => 无关/);
  assert.match(prompt, /请用中文输出/);
});

test('buildRedditSummaryPrompt uses generic AI wording when no terms match', () => {
  const prompt = buildRedditSummaryPrompt({
    source: DEFAULT_AI_REDDIT_SOURCES[0],
    post: {
      title: 'Local coding models',
      url: 'https://www.reddit.com/r/vibecoding/comments/abc/local_coding_models/',
      content: 'Can Ollama replace frontier coding models?',
    },
    comments: [
      { author: 'builder', score: 10, body: 'Qwen Coder is useful locally, but Claude is stronger.' },
    ],
    terms: [],
  });

  assert.match(prompt, /保留 AI、编程、模型、工具名等专有名词/);
  assert.doesNotMatch(prompt, /TFT/);
  assert.doesNotMatch(prompt, /术语映射：/);
});

test('buildRedditSummaryPrompt describes user submitted sources without subreddit wording', () => {
  const source = DEFAULT_REDDIT_SOURCES.find((item) => item.name === 'Lunaedge');
  const prompt = buildRedditSummaryPrompt({
    source,
    post: {
      title: 'Yesterday submitted guide',
      url: 'https://www.reddit.com/user/Lunaedge/comments/abc/yesterday_submitted_guide/',
      author: 'Lunaedge',
      score: 12,
      commentCount: 0,
      content: 'Useful details.',
    },
    comments: [],
    terms: [],
  });

  assert.match(prompt, /Reddit 用户 Lunaedge 昨日发布帖子摘要/);
  assert.doesNotMatch(prompt, /\/r\/Lunaedge/);
});

test('renderRedditSection writes title link and Chinese summary', () => {
  const section = renderRedditSection({
    discussions: [
      {
        source: DEFAULT_REDDIT_SOURCES[0],
        post: {
          title: 'Patch 17.3 meta discussion',
          url: 'https://www.reddit.com/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
          score: 321,
          commentCount: 42,
        },
        summary: '- 速八阵容讨论热度较高。\n- 评论认为赌狗仍可玩。',
      },
      {
        source: DEFAULT_REDDIT_SOURCES[1],
        post: {
          title: 'Funny TFT clip',
          url: 'https://www.reddit.com/r/TeamfightTactics/comments/xyz/funny_tft_clip/',
          score: 100,
          commentCount: 10,
        },
        summary: '- 玩家主要讨论娱乐性内容。',
      },
    ],
  });

  assert.match(section, /^#### Reddit/m);
  assert.match(section, /- \[ \] CompetitiveTFT｜\[Patch 17\.3 meta discussion\]/);
  assert.match(section, /%% source: TFT\|Reddit\|CompetitiveTFT\|https:\/\/www\.reddit\.com\/r\/CompetitiveTFT\/hot\/ %%/);
  assert.match(section, /> \[!summary\]- 中文总结/);
  assert.match(section, /> - 速八阵容讨论热度较高。/);
  assert.match(section, /- \[ \] TeamfightTactics｜\[Funny TFT clip\]/);
  assert.doesNotMatch(section, /评论原文/);
});

test('upsertRedditSection replaces only the reddit hot post section', () => {
  const original = '# Daily\n\n## TFT 信息聚合\n\n#### Tacter\n- [ ] keep\n\n#### Reddit\nold\n\n## AI\n\nkeep';
  const next = upsertRedditSection(original, '#### Reddit\n\nnew');

  assert.equal(next, '# Daily\n\n## TFT 信息聚合\n\n#### Tacter\n- [ ] keep\n\n#### Reddit\n\nnew\n\n## AI\n\nkeep');
});

test('writeRedditDiary writes the rendered reddit section', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reddit-diary-'));
  const result = await writeRedditDiary({
    diaryDir,
    today: '2026-05-15',
    discussions: [{
      source: DEFAULT_REDDIT_SOURCES[0],
      post: {
        title: 'Patch 17.3 meta discussion',
        url: 'https://www.reddit.com/r/CompetitiveTFT/comments/abc/patch_173_meta_discussion/',
        score: 321,
        commentCount: 42,
      },
      summary: '- 讨论集中在速八和赌狗阵容。',
    }],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /## TFT 信息聚合/);
  assert.match(diary, /#### Reddit/);
  assert.match(diary, /- 讨论集中在速八和赌狗阵容。/);
});

test('upsertAiRedditSection writes reddit under AI and preserves TFT section', () => {
  const original = '## TFT 信息聚合\n\n#### Reddit\nkeep tft\n\n## AI\n\nold ai\n\n## 随手记\n\nkeep note';
  const next = upsertAiRedditSection(original, '#### Reddit\n\nnew ai reddit');

  assert.equal(next, '## TFT 信息聚合\n\n#### Reddit\nkeep tft\n\n## AI\n\nold ai\n\n#### Reddit\n\nnew ai reddit\n\n## 随手记\n\nkeep note');
});

test('ensureAiLinuxDoLink inserts weekly ranking link without replacing existing linuxdo section', () => {
  const original = '## AI\n\n#### Reddit\nkeep ai\n\n#### Linux.do\n- [x] [每周排行榜 - 开发调优](https://linux.do/c/develop/4/l/top?period=weekly)\n\n## 随手记\n\nkeep note';
  const next = ensureAiLinuxDoLink(original);

  assert.equal(next, original);

  const inserted = ensureAiLinuxDoLink('## AI\n\n#### Reddit\nkeep ai\n\n## 随手记\n\nkeep note');
  assert.match(inserted, /#### Linux\.do/);
  assert.match(inserted, /每周排行榜 - 开发调优/);
});

test('upsertLifeRedditSection writes reddit under life and preserves AI section', () => {
  const original = '## AI\n\n#### Reddit\nkeep ai\n\n## 生活\n\nold life\n\n## 随手记\n\nkeep note';
  const next = upsertLifeRedditSection(original, '#### Reddit\n\nnew life reddit');

  assert.equal(next, '## AI\n\n#### Reddit\nkeep ai\n\n## 生活\n\nold life\n\n#### Reddit\n\nnew life reddit\n\n## 随手记\n\nkeep note');
});

test('upsertLifeRedditSection inserts life before quick notes when missing', () => {
  const original = '## AI\n\n#### Reddit\nkeep ai\n\n## 随手记\n\nkeep note';
  const next = upsertLifeRedditSection(original, '#### Reddit\n\nnew life reddit');

  assert.equal(next, '## AI\n\n#### Reddit\nkeep ai\n\n## 生活\n\n#### Reddit\n\nnew life reddit\n\n## 随手记\n\nkeep note');
});

test('writeAiRedditDiary writes vibecoding summary to AI section', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-reddit-diary-'));
  const result = await writeAiRedditDiary({
    diaryDir,
    today: '2026-05-18',
    discussions: [{
      source: DEFAULT_AI_REDDIT_SOURCES[0],
      post: {
        title: 'Show HN style vibe coding tool',
        url: 'https://www.reddit.com/r/vibecoding/comments/abc/show_hn_style_vibe_coding_tool/',
        score: 88,
        commentCount: 12,
      },
      summary: '- 讨论集中在 AI 编程工作流和工具选择。',
    }],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /## AI/);
  assert.match(diary, /#### Reddit/);
  assert.match(diary, /#### Linux\.do/);
  assert.match(diary, /每周排行榜 - 开发调优/);
  assert.match(diary, /- \[ \] vibecoding｜\[Show HN style vibe coding tool\]/);
  assert.match(diary, /- 讨论集中在 AI 编程工作流和工具选择。/);
});

test('writeLifeRedditDiary writes life subreddit summaries to life section', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'life-reddit-diary-'));
  const result = await writeLifeRedditDiary({
    diaryDir,
    today: '2026-05-18',
    discussions: [{
      source: DEFAULT_LIFE_REDDIT_SOURCES[0],
      post: {
        title: 'Protein and breakfast',
        url: 'https://www.reddit.com/r/nutrition/comments/abc/protein_and_breakfast/',
        score: 50,
        commentCount: 9,
      },
      summary: '- 讨论集中在早餐蛋白质摄入。',
    }],
  });
  const diary = await fs.readFile(result.diaryPath, 'utf8');

  assert.match(diary, /## 生活/);
  assert.match(diary, /#### Reddit/);
  assert.match(diary, /- \[ \] nutrition｜\[Protein and breakfast\]/);
  assert.match(diary, /- 讨论集中在早餐蛋白质摄入。/);
});
