import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDiaryOrTemplate } from './diary-template.mjs';
import { getShanghaiToday, resolveSystemChromeExecutable } from './browser-diary.mjs';

const currentFile = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(currentFile);
const DEFAULT_DIARY_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..');
const DEFAULT_PROFILE_DIR = 'D:\\tmp\\chrome-cdp-profile';
const AI_SECTION_HEADING = '## AI';
const LIFE_SECTION_HEADING = '## 生活';
const X_PLATFORM_HEADING = '#### X';

export const DEFAULT_AI_X_SOURCES = [
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
];

export const DEFAULT_LIFE_X_SOURCES = [
  {
    platform: 'X',
    name: 'Mark_Sisson',
    handle: 'Mark_Sisson',
    url: 'https://x.com/Mark_Sisson',
  },
  {
    platform: 'X',
    name: 'foundmyfitness',
    handle: 'foundmyfitness',
    url: 'https://x.com/foundmyfitness',
  },
];

export const DEFAULT_X_SOURCES = DEFAULT_AI_X_SOURCES;

function cleanText(value = '') {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toShanghaiDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function previousShanghaiDate(today) {
  const date = new Date(`${today}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return toShanghaiDate(date);
}

export function filterRecentXPosts(posts = [], today = getShanghaiToday()) {
  const allowedDates = new Set([previousShanghaiDate(today)]);
  const seen = new Set();
  const rows = [];

  for (const post of posts) {
    const date = toShanghaiDate(post.createdAt);
    const key = post.url || `${post.text}\n${post.createdAt}`;
    if (!post.text || !post.url || !allowedDates.has(date) || seen.has(key)) continue;
    rows.push({ ...post, shanghaiDate: date });
    seen.add(key);
  }

  return rows;
}

export function filterXPostsBySource(posts = [], source = DEFAULT_X_SOURCES[0]) {
  const handle = String(source.handle || '').toLowerCase();
  if (!handle) return posts;
  return posts.filter((post) => {
    try {
      const url = new URL(post.url);
      const pathHandle = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
      return pathHandle === handle;
    } catch {
      return false;
    }
  });
}

export function isXShowMoreText(value = '') {
  return /^(show more|显示更多|展开|更多)$/i.test(cleanText(value));
}

export function isRecoverableXNavigationError(error) {
  return /Execution context was destroyed/i.test(error?.message || '');
}

export function shouldFetchXStatusDetail(post = {}) {
  const text = cleanText(post.text);
  if (!text) return false;
  return /…$/.test(text) || /https?:\/\/\S*…$/.test(text) || /\bx\.com\/\S*…$/i.test(text);
}

async function openXBrowser(profileDir) {
  const { chromium } = await import('playwright');
  const executablePath = await resolveSystemChromeExecutable();
  await fs.mkdir(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: false,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 1000 },
  });
}

function buildXHighlightsExtractor() {
  return () => {
    const clean = (value = '') => String(value)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const normalizeUrl = (value) => {
      if (!value) return '';
      if (value.startsWith('http')) return value.replace('https://twitter.com/', 'https://x.com/');
      if (value.startsWith('/')) return `https://x.com${value}`;
      return value;
    };

    return [...document.querySelectorAll('article[data-testid="tweet"], article')]
      .map((article) => {
        const time = article.querySelector('time[datetime]');
        const createdAt = time?.getAttribute('datetime') || '';
        const statusAnchor = time?.closest('a[href*="/status/"]')
          || article.querySelector('a[href*="/status/"]');
        const textNodes = [...article.querySelectorAll('[data-testid="tweetText"]')];
        const text = clean(textNodes.map((node) => node.innerText || node.textContent || '').filter(Boolean).join('\n\n'));
        return {
          text,
          url: normalizeUrl(statusAnchor?.getAttribute('href') || ''),
          createdAt,
        };
      })
      .filter((post) => post.text && post.url && post.createdAt);
  };
}

function buildXShowMoreExpander() {
  return async () => {
    const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const isShowMore = (value = '') => /^(show more|显示更多|展开|更多)$/i.test(clean(value));
    const articles = [...document.querySelectorAll('article[data-testid="tweet"], article')];
    let count = 0;

    for (const article of articles) {
      const controls = [
        ...article.querySelectorAll('button, [role="button"], a[role="button"], span'),
      ];
      const target = controls.find((element) => isShowMore(element.textContent || element.getAttribute('aria-label') || ''));
      if (!target) continue;
      target.click();
      count += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return count;
  };
}

function buildXStatusExtractor() {
  return () => {
    const clean = (value = '') => String(value)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const article = document.querySelector('article[data-testid="tweet"], article');
    const time = article?.querySelector('time[datetime]');
    const textNodes = [...(article?.querySelectorAll('[data-testid="tweetText"]') || [])];
    return {
      text: clean(textNodes.map((node) => node.innerText || node.textContent || '').filter(Boolean).join('\n\n')),
      createdAt: time?.getAttribute('datetime') || '',
    };
  };
}

export function mergeXPostDetail(post, detail = {}) {
  const detailText = cleanText(detail.text);
  return {
    ...post,
    text: detailText.length > cleanText(post.text).length ? detailText : post.text,
    createdAt: post.createdAt || detail.createdAt,
  };
}

async function waitForXTimelineAfterNavigation(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('article, main', { timeout: 20000 });
}

export async function collectXPostsWithBrowser({
  profileDir = DEFAULT_PROFILE_DIR,
  source = DEFAULT_X_SOURCES[0],
  today = getShanghaiToday(),
} = {}) {
  const context = await openXBrowser(profileDir);
  const page = await context.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('article, main', { timeout: 45000 });

    const collected = [];
    for (let index = 0; index < 8; index++) {
      await page.waitForTimeout(index === 0 ? 2500 : 900);
      try {
        await page.evaluate(buildXShowMoreExpander());
      } catch (error) {
        if (!isRecoverableXNavigationError(error)) throw error;
        await waitForXTimelineAfterNavigation(page);
      }
      await page.waitForTimeout(300);
      let visible;
      try {
        visible = await page.evaluate(buildXHighlightsExtractor());
      } catch (error) {
        if (!isRecoverableXNavigationError(error)) throw error;
        await waitForXTimelineAfterNavigation(page);
        visible = await page.evaluate(buildXHighlightsExtractor());
      }
      collected.push(...visible);
      const recent = filterRecentXPosts(filterXPostsBySource(collected, source), today);
      const hasOlder = visible.some((post) => {
        const date = toShanghaiDate(post.createdAt);
        return date && date < previousShanghaiDate(today);
      });
      if (recent.length > 0 && hasOlder) break;
      await page.mouse.wheel(0, 900);
    }

    const recent = filterRecentXPosts(filterXPostsBySource(collected, source), today);
    const detailed = [];
    for (const post of recent) {
      if (!shouldFetchXStatusDetail(post)) {
        detailed.push(post);
        continue;
      }
      await page.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try {
        await page.waitForSelector('article[data-testid="tweet"], article', { timeout: 20000 });
        await page.waitForTimeout(1200);
        const detail = await page.evaluate(buildXStatusExtractor());
        detailed.push(mergeXPostDetail(post, detail));
      } catch {
        detailed.push(post);
      }
    }

    return detailed;
  } finally {
    await page.close();
    await context.close();
  }
}

export async function collectXDiscussionsWithBrowser({
  profileDir = DEFAULT_PROFILE_DIR,
  sources = DEFAULT_AI_X_SOURCES,
  today = getShanghaiToday(),
} = {}) {
  const discussions = [];
  for (const source of sources) {
    const posts = await collectXPostsWithBrowser({ profileDir, source, today });
    discussions.push({ source, posts });
  }
  return discussions;
}

function normalizeDiscussions({ discussions, source = DEFAULT_X_SOURCES[0], posts = [] } = {}) {
  if (Array.isArray(discussions)) return discussions;
  return [{ source, posts }];
}

export function buildXTranslationPrompt({ source = DEFAULT_X_SOURCES[0], posts = [], discussions } = {}) {
  const rows = normalizeDiscussions({ discussions, source, posts })
    .flatMap((discussion) => discussion.posts.map((post) => ({ source: discussion.source, post })));
  return [
    '请把 X 平台昨天的 posts 直接翻译为中文。',
    '',
    '要求：',
    '- 只输出中文译文，不要写总结、点评或折叠 callout。',
    '- 每条内容对应一个译文块，按原顺序输出。',
    '- 多条之间用单独一行 --- 分隔。',
    '- 保留 AI、产品名、机构名、模型名、人名、币种符号和链接文本等专有名词。',
    '- 如果原文很短，也要自然翻译，不要扩写。',
    '',
    ...rows.flatMap(({ source: rowSource, post }, index) => [
      `## ${index + 1}`,
      `作者：${rowSource.name}`,
      `链接：${post.url}`,
      `发布时间：${post.createdAt}`,
      '',
      post.text,
      '',
    ]),
  ].join('\n').trimEnd();
}

function extractMarkdownSection(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return { start: -1, end: -1 };
  const nextHeadingMatch = markdown.slice(start + heading.length).match(/\n## /);
  const end = nextHeadingMatch
    ? start + heading.length + nextHeadingMatch.index
    : markdown.length;
  return { start, end, content: markdown.slice(start, end) };
}

function replacePlatformSection(section, heading, nextSection) {
  const start = section.indexOf(heading);
  if (start === -1) {
    return `${section.trimEnd()}\n\n${nextSection}`;
  }

  const nextPlatformMatch = section.slice(start + heading.length).match(/\n####\s+/);
  const end = nextPlatformMatch
    ? start + heading.length + nextPlatformMatch.index
    : section.length;
  return `${section.slice(0, start).trimEnd()}\n\n${nextSection}\n\n${section.slice(end).trimStart()}`.trimEnd();
}

export function upsertAiXSection(markdown, section) {
  const { start, end, content } = extractMarkdownSection(markdown, AI_SECTION_HEADING);
  if (start === -1) {
    const aiSection = `${AI_SECTION_HEADING}\n\n${section}`;
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${aiSection}` : aiSection;
  }

  const nextAiSection = replacePlatformSection(content, X_PLATFORM_HEADING, section);
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextAiSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

export function upsertLifeXSection(markdown, section) {
  const { start, end, content } = extractMarkdownSection(markdown, LIFE_SECTION_HEADING);
  if (start === -1) {
    const lifeSection = `${LIFE_SECTION_HEADING}\n\n${section}`;
    const noteStart = markdown.indexOf('\n## 随手记');
    if (noteStart !== -1) {
      return `${markdown.slice(0, noteStart).trimEnd()}\n\n${lifeSection}\n\n${markdown.slice(noteStart + 1).trimStart()}`.trimStart();
    }
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${lifeSection}` : lifeSection;
  }

  const nextLifeSection = replacePlatformSection(content, X_PLATFORM_HEADING, section);
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextLifeSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

function inferSourceModule(source = DEFAULT_X_SOURCES[0]) {
  if (DEFAULT_LIFE_X_SOURCES.some((item) => item.handle === source.handle)) return '生活';
  return 'AI';
}

function renderSourceTranslations(discussion) {
  const sourceModule = discussion.module || inferSourceModule(discussion.source);
  const translationLines = discussion.posts.flatMap((post, index) => [
    ...(index === 0 ? [] : ['  >', '  > ---', '  >']),
    ...cleanText(post.translation)
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `  > ${line}` : '  >')),
  ]);
  return [
    `- [ ] [${discussion.source.name}](${discussion.source.url})`,
    `  %% source: ${[sourceModule, discussion.source.platform, discussion.source.name, discussion.source.url].filter(Boolean).join('|')} %%`,
    '  > [!quote]- 中文翻译',
    ...translationLines,
  ];
}

export function renderXSection({ source = DEFAULT_X_SOURCES[0], posts = [], discussions } = {}) {
  const rows = normalizeDiscussions({ discussions, source, posts })
    .filter((discussion) => discussion.posts.length > 0);
  if (rows.length === 0) throw new Error('缺少 X posts 内容。');
  return [
    X_PLATFORM_HEADING,
    ...rows.flatMap((discussion, index) => [
      ...(index === 0 ? [] : ['']),
      ...renderSourceTranslations(discussion),
    ]),
  ].join('\n');
}

function validateDiscussions(discussions) {
  const rows = normalizeDiscussions({ discussions }).filter((discussion) => discussion.posts.length > 0);
  if (rows.length === 0) throw new Error('缺少 X posts 内容。');
  if (rows.some((discussion) => discussion.posts.some((post) => !post.translation))) throw new Error('缺少 X 中文翻译。');
  return rows;
}

export async function writeAiXDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  source = DEFAULT_X_SOURCES[0],
  posts = [],
  discussions,
} = {}) {
  const rows = validateDiscussions(normalizeDiscussions({ discussions, source, posts }));

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const section = renderXSection({ discussions: rows });
  const next = upsertAiXSection(current, section);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, section, count: rows.reduce((sum, discussion) => sum + discussion.posts.length, 0) };
}

export async function writeLifeXDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  source = DEFAULT_LIFE_X_SOURCES[0],
  posts = [],
  discussions,
} = {}) {
  const rows = validateDiscussions(normalizeDiscussions({ discussions, source, posts }));

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const section = renderXSection({ discussions: rows });
  const next = upsertLifeXSection(current, section);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, section, count: rows.reduce((sum, discussion) => sum + discussion.posts.length, 0) };
}

function getArg(argv, ...names) {
  for (const name of names) {
    const arg = argv.find((item) => item.startsWith(`--${name}=`));
    if (arg) return arg.slice(name.length + 3);
  }
  return undefined;
}

function resolveFixedProfileDir(profileDir = DEFAULT_PROFILE_DIR) {
  const actual = path.normalize(profileDir).toLowerCase();
  const expected = path.normalize(DEFAULT_PROFILE_DIR).toLowerCase();
  if (actual !== expected) {
    throw new Error(`浏览器 profile 必须使用固定目录 ${DEFAULT_PROFILE_DIR}，当前为 ${profileDir}`);
  }
  return DEFAULT_PROFILE_DIR;
}

export function buildRuntimeOptions(argv) {
  return {
    today: getArg(argv, 'date') || getShanghaiToday(),
    diaryDir: getArg(argv, 'diary-dir') || DEFAULT_DIARY_DIR,
    profileDir: resolveFixedProfileDir(getArg(argv, 'user-data-dir', 'profile-dir') || DEFAULT_PROFILE_DIR),
    outputDiscussionFile: getArg(argv, 'output-discussion'),
    discussionFile: getArg(argv, 'discussion-file'),
    summaryFile: getArg(argv, 'summary-file'),
    section: getArg(argv, 'section') || 'ai',
  };
}

function sourcesForSection(section) {
  return section === 'life' ? DEFAULT_LIFE_X_SOURCES : DEFAULT_AI_X_SOURCES;
}

function parseDiscussionFile(content, sources) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.source || parsed[0]?.posts)) {
    return parsed;
  }
  if (Array.isArray(parsed)) return [{ source: sources[0], posts: parsed }];
  throw new Error('X discussion-file 格式无效。');
}

function applyTranslations(discussions, summaryContent) {
  const translations = summaryContent.split(/\n---+\n/).map((item) => item.trim()).filter(Boolean);
  let translationIndex = 0;
  return discussions.map((discussion) => ({
    ...discussion,
    posts: discussion.posts.map((post) => ({
      ...post,
      translation: translations[translationIndex++] || translations[0],
    })),
  }));
}

async function main() {
  const options = buildRuntimeOptions(process.argv.slice(2));
  const sources = sourcesForSection(options.section);
  const discussions = options.discussionFile
    ? parseDiscussionFile(await fs.readFile(options.discussionFile, 'utf8'), sources)
    : await collectXDiscussionsWithBrowser({
      profileDir: options.profileDir,
      sources,
      today: options.today,
    });

  if (options.outputDiscussionFile) {
    await fs.mkdir(path.dirname(options.outputDiscussionFile), { recursive: true });
    await fs.writeFile(options.outputDiscussionFile, `${JSON.stringify(discussions, null, 2)}\n`, 'utf8');
    console.log(`X 结构化内容已写入: ${options.outputDiscussionFile}`);
  }

  if (options.summaryFile) {
    const summaryContent = await fs.readFile(options.summaryFile, 'utf8');
    const translatedDiscussions = applyTranslations(discussions, summaryContent);
    const writeDiary = options.section === 'life' ? writeLifeXDiary : writeAiXDiary;
    const result = await writeDiary({
      diaryDir: options.diaryDir,
      today: options.today,
      discussions: translatedDiscussions,
    });
    console.log(`X posts 翻译写入完成: ${result.diaryPath}`);
    console.log(`条目数量: ${result.count}`);
    return;
  }

  console.log(JSON.stringify(discussions, null, 2));
  console.log('\n--- AI TRANSLATION PROMPT ---\n');
  console.log(buildXTranslationPrompt({ discussions }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(`X 采集失败: ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}
