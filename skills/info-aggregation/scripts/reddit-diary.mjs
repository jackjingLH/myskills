import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDiaryOrTemplate } from './diary-template.mjs';
import { getShanghaiToday, resolveSystemChromeExecutable } from './browser-diary.mjs';

const currentFile = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(currentFile);
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DIARY_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..');
const DEFAULT_TERMS_DIR = path.resolve(SKILL_DIR, 'references', 'terms');

const TFT_SECTION_HEADING = '## TFT 信息聚合';
const AI_SECTION_HEADING = '## AI';
const LIFE_SECTION_HEADING = '## 生活';
const REDDIT_PLATFORM_HEADING = '#### Reddit';
const LINUXDO_PLATFORM_HEADING = '#### Linux.do';
const LINUXDO_WEEKLY_LINK = [
  '- [ ] [每周排行榜 - 开发调优](https://linux.do/c/develop/4/l/top?period=weekly)',
  '  %% source: AI|Linux.do|开发调优周榜|https://linux.do/c/develop/4/l/top?period=weekly %%',
].join('\n');
const SUBREDDIT_URL = 'https://www.reddit.com/r/CompetitiveTFT/hot/';
const HOT_JSON_URL = 'https://www.reddit.com/r/CompetitiveTFT/hot.json?limit=10&raw_json=1';
const COMMENT_LIMIT = 20;
const DEFAULT_PROFILE_DIR = 'D:\\tmp\\chrome-cdp-profile';

export const DEFAULT_REDDIT_SOURCES = [
  {
    platform: 'Reddit',
    name: 'CompetitiveTFT',
    url: 'https://www.reddit.com/r/CompetitiveTFT/hot/',
  },
  {
    platform: 'Reddit',
    name: 'TeamfightTactics',
    url: 'https://www.reddit.com/r/TeamfightTactics/hot/',
  },
  {
    platform: 'Reddit',
    name: 'Lunaedge',
    kind: 'user-submitted',
    url: 'https://www.reddit.com/user/Lunaedge/submitted/',
    jsonUrl: 'https://www.reddit.com/user/Lunaedge/submitted/.json?limit=25&raw_json=1',
  },
];

export const DEFAULT_AI_REDDIT_SOURCES = [
  {
    platform: 'Reddit',
    name: 'vibecoding',
    url: 'https://www.reddit.com/r/vibecoding/hot/',
  },
  {
    platform: 'Reddit',
    name: 'ArtificialInteligence',
    url: 'https://www.reddit.com/r/ArtificialInteligence/hot/',
  },
];

export const DEFAULT_LIFE_REDDIT_SOURCES = [
  {
    platform: 'Reddit',
    name: 'nutrition',
    url: 'https://www.reddit.com/r/nutrition/hot/',
  },
  {
    platform: 'Reddit',
    name: 'badbreath',
    url: 'https://www.reddit.com/r/badbreath/hot/',
  },
  {
    platform: 'Reddit',
    name: 'Parenting',
    url: 'https://www.reddit.com/r/Parenting/hot/',
  },
];

function cleanText(value = '') {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeRedditUrl(value) {
  if (!value) return SUBREDDIT_URL;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `https://www.reddit.com${value}`;
  return value;
}

export function buildRedditPostFromElement({
  title,
  contentHref,
  commentsHref,
  text,
  author = '',
  score = 0,
  commentCount = 0,
} = {}) {
  const postTitle = cleanText(title);
  const url = normalizeRedditUrl(commentsHref || contentHref);
  return {
    title: postTitle,
    url,
    content: cleanText(text || ''),
    author: cleanText(author),
    score,
    commentCount,
    createdUtc: 0,
  };
}

function buildHotJsonUrl(source = DEFAULT_REDDIT_SOURCES[0]) {
  const normalized = source.url.replace(/\/$/, '').replace(/\/hot$/, '');
  return `${normalized}/hot.json?limit=10&raw_json=1`;
}

function toShanghaiDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function previousShanghaiDate(today) {
  const base = new Date(`${today}T00:00:00+08:00`);
  return toShanghaiDate(new Date(base.getTime() - 24 * 60 * 60 * 1000));
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export async function loadTermMappings(termsDir = DEFAULT_TERMS_DIR) {
  const terms = [];

  for (const fileName of ['en_to_zh.csv', 'jp_to_zh.csv']) {
    const filePath = path.join(termsDir, fileName);
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      continue;
    }

    for (const line of content.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;
      const [source, target] = parseCsvLine(line);
      if (source && target) terms.push({ source, target });
    }
  }

  try {
    const zhTerms = await fs.readFile(path.join(termsDir, 'zh_terms.csv'), 'utf8');
    for (const line of zhTerms.split(/\r?\n/).slice(1)) {
      const source = line.trim();
      if (source) terms.push({ source, target: source });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return terms;
}

export function extractTopHotPost(listing) {
  const child = listing?.data?.children?.find((item) => item?.kind === 't3' || item?.data?.title);
  if (!child) throw new Error('Reddit hot 列表中没有找到帖子。');
  const data = child.data;

  return {
    id: data.id,
    title: cleanText(data.title),
    url: normalizeRedditUrl(data.permalink || data.url),
    content: cleanText(data.selftext || ''),
    author: data.author || '',
    score: data.score || 0,
    commentCount: data.num_comments || 0,
    createdUtc: data.created_utc || 0,
  };
}

export function extractUserSubmittedPosts(listing, { today = getShanghaiToday() } = {}) {
  const targetDate = previousShanghaiDate(today);
  return (listing?.data?.children || [])
    .filter((item) => item?.kind === 't3' || item?.data?.title)
    .map((item) => {
      const data = item.data || {};
      return {
        id: data.id,
        title: cleanText(data.title),
        url: normalizeRedditUrl(data.permalink || data.url),
        content: cleanText(data.selftext || ''),
        author: data.author || '',
        score: data.score || 0,
        commentCount: data.num_comments || 0,
        createdUtc: data.created_utc || 0,
        publishedDate: data.created_utc ? toShanghaiDate(new Date(data.created_utc * 1000)) : '',
      };
    })
    .filter((post) => post.title && post.url && post.publishedDate === targetDate);
}

function pushComment(rows, node, depth, limit) {
  if (rows.length >= limit || node?.kind !== 't1') return;
  const data = node.data || {};
  const body = cleanText(data.body || '');
  if (body && body !== '[deleted]' && body !== '[removed]') {
    rows.push({
      author: data.author || '',
      body,
      score: data.score || 0,
      createdUtc: data.created_utc || 0,
      depth,
    });
  }

  const replies = data.replies?.data?.children || [];
  for (const reply of replies) {
    if (rows.length >= limit) break;
    pushComment(rows, reply, depth + 1, limit);
  }
}

export function extractCommentItems(commentsListing, { limit = COMMENT_LIMIT } = {}) {
  const children = commentsListing?.[1]?.data?.children || [];
  const rows = [];
  for (const child of children) {
    if (rows.length >= limit) break;
    pushComment(rows, child, 0, limit);
  }
  return rows;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 info-aggregation/1.0 (TFT Reddit daily summary)',
        Accept: 'application/json',
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Reddit JSON 解析失败: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Reddit 请求超时'));
    });
    req.end();
  });
}

export async function collectRedditDiscussion({
  fetchJsonFn = requestJson,
  commentLimit = COMMENT_LIMIT,
  profileDir,
  source = DEFAULT_REDDIT_SOURCES[0],
} = {}) {
  if (profileDir) {
    return collectRedditDiscussionWithBrowser({ profileDir, commentLimit, source });
  }

  const hotListing = await fetchJsonFn(source.url === SUBREDDIT_URL ? HOT_JSON_URL : buildHotJsonUrl(source));
  const post = extractTopHotPost(hotListing);
  const commentsListing = await fetchJsonFn(`https://www.reddit.com/comments/${post.id}.json?sort=top&limit=${commentLimit}&raw_json=1`);
  const comments = extractCommentItems(commentsListing, { limit: commentLimit });
  return { post, comments };
}

async function collectRedditUserSubmitted({
  fetchJsonFn = requestJson,
  profileDir,
  source,
  today = getShanghaiToday(),
} = {}) {
  const listing = profileDir
    ? await collectRedditUserSubmittedJsonWithBrowser({ profileDir, source })
    : await fetchJsonFn(source.jsonUrl || buildUserSubmittedJsonUrl(source));
  return extractUserSubmittedPosts(listing, { today })
    .map((post) => ({ source, post, comments: [] }));
}

function buildUserSubmittedJsonUrl(source) {
  return `${source.url.replace(/\/$/, '')}/.json?limit=25&raw_json=1`;
}

async function openRedditBrowser(profileDir) {
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

function buildBrowserPostExtractor() {
  return () => {
    const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const normalizeUrl = (value) => {
      if (!value) return '';
      if (value.startsWith('http')) return value;
      if (value.startsWith('/')) return `https://www.reddit.com${value}`;
      return value;
    };

    const postElements = [...document.querySelectorAll('shreddit-post')];
    for (const element of postElements) {
      const title = clean(
        element.getAttribute('post-title')
        || element.querySelector('a[slot="title"], h1, h2, a[href*="/comments/"]')?.textContent
        || '',
      );
      const commentsHref = element.getAttribute('permalink')
        || element.querySelector('a[href*="/comments/"]')?.getAttribute('href')
        || '';
      const contentHref = element.getAttribute('content-href') || commentsHref;
      const author = clean(element.getAttribute('author') || element.querySelector('a[href*="/user/"]')?.textContent || '');
      const score = Number.parseInt(String(element.getAttribute('score') || '0').replace(/[^\d-]/g, ''), 10) || 0;
      const commentCount = Number.parseInt(String(element.getAttribute('comment-count') || '0').replace(/[^\d-]/g, ''), 10) || 0;

      if (!title || !(commentsHref || contentHref) || element.hasAttribute('stickied')) continue;
      if (/welcome to r\/competitivetft/i.test(title)) continue;

      return {
        title,
        url: normalizeUrl(commentsHref || contentHref),
        content: clean(element.innerText || ''),
        author,
        score,
        commentCount,
        createdUtc: 0,
      };
    }

    const main = document.querySelector('main') || document.body;
    const feedHeading = [...main.querySelectorAll('h1, h2, h3')]
      .find((heading) => /信息流|feed/i.test(heading.textContent || ''));
    const anchors = [...main.querySelectorAll('a[href*="/comments/"]')];
    const candidates = feedHeading
      ? anchors.filter((anchor) => Boolean(feedHeading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING))
      : anchors;

    for (const anchor of candidates) {
      const title = clean(anchor.textContent || anchor.getAttribute('aria-label') || '');
      const url = normalizeUrl(anchor.getAttribute('href') || '');
      if (!title || !url || /转到评论|welcome to r\//i.test(title)) continue;
      return {
        title,
        url,
        content: '',
        author: '',
        score: 0,
        commentCount: 0,
        createdUtc: 0,
      };
    }

    return null;
  };
}

function buildBrowserDiscussionExtractor(commentLimit) {
  return (limit) => {
    const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const postElement = document.querySelector('shreddit-post');
    const title = clean(
      postElement?.getAttribute('post-title')
      || document.querySelector('h1, h2')?.textContent
      || document.title.replace(/\s*:\s*.*$/, '')
      || '',
    );
    const content = clean(
      postElement?.querySelector('[slot="text-body"]')?.innerText
      || postElement?.innerText
      || '',
    );
    const author = clean(postElement?.getAttribute('author') || '');
    const score = Number.parseInt(String(postElement?.getAttribute('score') || '0').replace(/[^\d-]/g, ''), 10) || 0;
    const commentCount = Number.parseInt(String(postElement?.getAttribute('comment-count') || '0').replace(/[^\d-]/g, ''), 10) || 0;

    const comments = [];
    const commentElements = [...document.querySelectorAll('shreddit-comment')];
    for (const element of commentElements) {
      if (comments.length >= limit) break;
      const body = clean(
        element.querySelector('[slot="comment"]')?.innerText
        || element.querySelector('div[id*="comment"], p')?.innerText
        || element.innerText
        || '',
      );
      if (!body || body === '[deleted]' || body === '[removed]') continue;
      comments.push({
        author: clean(element.getAttribute('author') || ''),
        body,
        score: Number.parseInt(String(element.getAttribute('score') || '0').replace(/[^\d-]/g, ''), 10) || 0,
        createdUtc: 0,
        depth: Number.parseInt(element.getAttribute('depth') || '0', 10) || 0,
      });
    }

    return { post: { title, content, author, score, commentCount }, comments };
  };
}

export async function collectRedditDiscussionWithBrowser({
  profileDir = DEFAULT_PROFILE_DIR,
  commentLimit = COMMENT_LIMIT,
  source = DEFAULT_REDDIT_SOURCES[0],
} = {}) {
  const context = await openRedditBrowser(profileDir);
  const page = await context.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('main a[href*="/comments/"], shreddit-post', { timeout: 45000 });
    await page.waitForTimeout(2500);
    const topPost = await page.evaluate(buildBrowserPostExtractor());
    if (!topPost?.url) throw new Error('未能从 Reddit 页面提取 hot 第一条帖子。');

    await page.goto(topPost.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForSelector('shreddit-post, h1, h2, main', { timeout: 20000 });
    } catch {
      return { post: topPost, comments: [] };
    }
    for (let index = 0; index < 4; index++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(700);
    }

    const discussion = await page.evaluate(buildBrowserDiscussionExtractor(commentLimit), commentLimit);
    return {
      post: {
        ...topPost,
        ...discussion.post,
        url: topPost.url,
        title: discussion.post.title || topPost.title,
        content: discussion.post.content || topPost.content,
      },
      comments: discussion.comments,
    };
  } finally {
    await page.close();
    await context.close();
  }
}

async function collectRedditUserSubmittedJsonWithBrowser({
  profileDir = DEFAULT_PROFILE_DIR,
  source,
} = {}) {
  const context = await openRedditBrowser(profileDir);
  const page = await context.newPage();
  try {
    await page.goto(source.jsonUrl || buildUserSubmittedJsonUrl(source), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const text = await page.locator('body').innerText({ timeout: 20000 });
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Reddit 用户 submitted JSON 解析失败: ${error.message}`);
    }
  } finally {
    await page.close();
    await context.close();
  }
}

export async function collectRedditDiscussions({
  sources = DEFAULT_REDDIT_SOURCES,
  fetchJsonFn = requestJson,
  commentLimit = COMMENT_LIMIT,
  profileDir,
  today = getShanghaiToday(),
} = {}) {
  const discussions = [];
  for (const source of sources) {
    if (source.kind === 'user-submitted') {
      discussions.push(...await collectRedditUserSubmitted({
        fetchJsonFn,
        profileDir,
        source,
        today,
      }));
      continue;
    }

    const discussion = await collectRedditDiscussion({
      fetchJsonFn,
      commentLimit,
      profileDir,
      source,
    });
    discussions.push({ source, ...discussion });
  }
  return discussions;
}

function selectRelevantTerms({ post, comments, terms, limit = 80 }) {
  const text = `${post.title}\n${post.content}\n${comments.map((comment) => comment.body).join('\n')}`.toLowerCase();
  const selected = [];
  const seen = new Set();

  for (const term of terms) {
    const source = String(term.source || '').trim();
    const target = String(term.target || '').trim();
    if (!source || !target) continue;
    const key = source.toLowerCase();
    if (seen.has(key)) continue;
    if (text.includes(key)) {
      selected.push({ source, target });
      seen.add(key);
    }
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildRedditSummaryPrompt({ source = DEFAULT_REDDIT_SOURCES[0], post, comments, terms = [] }) {
  const relevantTerms = selectRelevantTerms({ post, comments, terms });
  const commentLines = comments.map((comment, index) => (
    `${index + 1}. score=${comment.score} author=${comment.author}\n${comment.body}`
  ));
  const termRequirement = relevantTerms.length > 0
    ? '- 保留关键术语，按术语映射表统一中文译名。'
    : '- 保留 AI、编程、模型、工具名等专有名词，不要硬翻译产品名。';
  const termBlock = relevantTerms.length > 0
    ? [
      '',
      '术语映射：',
      ...relevantTerms.map((term) => `- ${term.source} => ${term.target}`),
    ]
    : [];

  const sourceIntro = source.kind === 'user-submitted'
    ? `请用中文输出 Reddit 用户 ${source.name} 昨日发布帖子摘要。`
    : `请用中文输出 Reddit /r/${source.name} 今日最热门帖子摘要。`;

  return [
    sourceIntro,
    '',
    '要求：',
    termRequirement,
    '- 总结正文和评论中的共识、争议点、实战结论。',
    '- 输出 3-6 条 Markdown bullet，不要写英文原文大段翻译。',
    '- 如果评论中没有可靠结论，要明确写“评论尚未形成一致结论”。',
    ...termBlock,
    '',
    '帖子：',
    `标题：${post.title}`,
    `链接：${post.url}`,
    `作者：${post.author || 'unknown'}｜分数：${post.score}｜评论数：${post.commentCount}`,
    '',
    '正文：',
    post.content || '无正文。',
    '',
    '热门评论：',
    ...(commentLines.length > 0 ? commentLines : ['无可用评论。']),
  ].join('\n');
}

function renderSummaryCallout(summary) {
  return [
    '> [!summary]- 中文总结',
    ...cleanText(summary)
      .split(/\r?\n/)
      .map((line) => `> ${line}`),
  ].join('\n');
}

function inferSourceModule(source = DEFAULT_REDDIT_SOURCES[0]) {
  if (DEFAULT_AI_REDDIT_SOURCES.some((item) => item.name === source.name)) return 'AI';
  if (DEFAULT_LIFE_REDDIT_SOURCES.some((item) => item.name === source.name)) return '生活';
  return 'TFT';
}

function renderSourceMeta({ module = '', source = DEFAULT_REDDIT_SOURCES[0] } = {}) {
  const sourceModule = module || inferSourceModule(source);
  return [
    `  %% source: ${[sourceModule, source.platform, source.name, source.url].filter(Boolean).join('|')} %%`,
  ].join('\n');
}

export function renderRedditSection({ post, summary, discussions }) {
  const rows = discussions || [{ source: DEFAULT_REDDIT_SOURCES[0], post, summary }];
  return [
    REDDIT_PLATFORM_HEADING,
    ...rows.flatMap((item, index) => [
      ...(index === 0 ? [] : ['']),
      `- [ ] ${item.source.name}｜[${item.post.title}](${item.post.url})`,
      renderSourceMeta(item),
      '',
      renderSummaryCallout(item.summary),
    ]),
  ].join('\n').trimEnd();
}

function extractTftSection(markdown) {
  const start = markdown.indexOf(TFT_SECTION_HEADING);
  if (start === -1) return { start: -1, end: -1 };
  const nextHeadingMatch = markdown.slice(start + TFT_SECTION_HEADING.length).match(/\n## /);
  const end = nextHeadingMatch
    ? start + TFT_SECTION_HEADING.length + nextHeadingMatch.index
    : markdown.length;
  return { start, end, content: markdown.slice(start, end) };
}

function replaceRedditPlatform(section, redditSection) {
  const start = section.indexOf(REDDIT_PLATFORM_HEADING);
  if (start === -1) {
    return `${section.trimEnd()}\n\n${redditSection}`;
  }

  const nextPlatformMatch = section.slice(start + REDDIT_PLATFORM_HEADING.length).match(/\n####\s+/);
  const end = nextPlatformMatch
    ? start + REDDIT_PLATFORM_HEADING.length + nextPlatformMatch.index
    : section.length;
  return `${section.slice(0, start).trimEnd()}\n\n${redditSection}\n\n${section.slice(end).trimStart()}`.trimEnd();
}

export function upsertRedditSection(markdown, section) {
  const { start, end, content } = extractTftSection(markdown);
  if (start === -1) {
    const tftSection = `${TFT_SECTION_HEADING}\n\n${section}`;
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${tftSection}` : tftSection;
  }

  const nextTftSection = replaceRedditPlatform(content, section);
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextTftSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
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

export function upsertAiRedditSection(markdown, section) {
  const { start, end, content } = extractMarkdownSection(markdown, AI_SECTION_HEADING);
  if (start === -1) {
    const aiSection = `${AI_SECTION_HEADING}\n\n${section}`;
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${aiSection}` : aiSection;
  }

  const nextAiSection = replaceRedditPlatform(content, section);
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextAiSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

export function ensureAiLinuxDoLink(markdown) {
  const { start, end, content } = extractMarkdownSection(markdown, AI_SECTION_HEADING);
  const linuxDoSection = `${LINUXDO_PLATFORM_HEADING}\n${LINUXDO_WEEKLY_LINK}`;
  if (start === -1) {
    const aiSection = `${AI_SECTION_HEADING}\n\n${linuxDoSection}`;
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${aiSection}` : aiSection;
  }
  if (content.includes(LINUXDO_PLATFORM_HEADING)) return markdown;

  const nextAiSection = `${content.trimEnd()}\n\n${linuxDoSection}`;
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextAiSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

export function upsertLifeRedditSection(markdown, section) {
  const { start, end, content } = extractMarkdownSection(markdown, LIFE_SECTION_HEADING);
  if (start === -1) {
    const lifeSection = `${LIFE_SECTION_HEADING}\n\n${section}`;
    const noteStart = markdown.indexOf('\n## 随手记');
    if (noteStart !== -1) {
      return `${markdown.slice(0, noteStart).trimEnd()}\n\n${lifeSection}\n\n${markdown.slice(noteStart + 1).trimStart()}`.trimStart();
    }
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${lifeSection}` : lifeSection;
  }

  const nextLifeSection = replaceRedditPlatform(content, section);
  return `${markdown.slice(0, start).trimEnd()}\n\n${nextLifeSection}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

export async function writeRedditDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  post,
  summary,
  discussions,
} = {}) {
  const rows = discussions || [{ source: DEFAULT_REDDIT_SOURCES[0], post, summary }];
  if (rows.some((row) => !row.post)) throw new Error('缺少 Reddit 帖子数据。');
  if (rows.some((row) => !row.summary)) throw new Error('缺少 Reddit 中文总结。');

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const section = renderRedditSection({ discussions: rows });
  const next = upsertRedditSection(current, section);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, section };
}

export async function writeAiRedditDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  post,
  summary,
  discussions,
} = {}) {
  const rows = discussions || [{ source: DEFAULT_AI_REDDIT_SOURCES[0], post, summary }];
  if (rows.some((row) => !row.post)) throw new Error('缺少 Reddit 帖子数据。');
  if (rows.some((row) => !row.summary)) throw new Error('缺少 Reddit 中文总结。');

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const section = renderRedditSection({ discussions: rows });
  const next = ensureAiLinuxDoLink(upsertAiRedditSection(current, section));
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, section };
}

export async function writeLifeRedditDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  post,
  summary,
  discussions,
} = {}) {
  const rows = discussions || [{ source: DEFAULT_LIFE_REDDIT_SOURCES[0], post, summary }];
  if (rows.some((row) => !row.post)) throw new Error('缺少 Reddit 帖子数据。');
  if (rows.some((row) => !row.summary)) throw new Error('缺少 Reddit 中文总结。');

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const section = renderRedditSection({ discussions: rows });
  const next = upsertLifeRedditSection(current, section);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, section };
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
    termsDir: getArg(argv, 'terms-dir') || DEFAULT_TERMS_DIR,
    profileDir: resolveFixedProfileDir(getArg(argv, 'user-data-dir', 'profile-dir') || DEFAULT_PROFILE_DIR),
    summaryFile: getArg(argv, 'summary-file'),
    discussionFile: getArg(argv, 'discussion-file'),
    outputDiscussionFile: getArg(argv, 'output-discussion'),
    section: getArg(argv, 'section') || 'tft',
  };
}

async function main() {
  const options = buildRuntimeOptions(process.argv.slice(2));
  const { today, diaryDir, termsDir, profileDir, summaryFile, discussionFile, outputDiscussionFile, section } = options;
  const terms = section === 'tft' ? await loadTermMappings(termsDir) : [];
  const sources = section === 'life'
    ? DEFAULT_LIFE_REDDIT_SOURCES
    : section === 'ai'
      ? DEFAULT_AI_REDDIT_SOURCES
      : DEFAULT_REDDIT_SOURCES;
  const discussions = discussionFile
    ? JSON.parse(await fs.readFile(discussionFile, 'utf8'))
    : await collectRedditDiscussions({ profileDir, sources, today });

  if (outputDiscussionFile) {
    await fs.mkdir(path.dirname(outputDiscussionFile), { recursive: true });
    await fs.writeFile(outputDiscussionFile, `${JSON.stringify(discussions, null, 2)}\n`, 'utf8');
    console.log(`Reddit 结构化内容已写入: ${outputDiscussionFile}`);
  }

  if (summaryFile) {
    const summaryContent = await fs.readFile(summaryFile, 'utf8');
    const summaries = summaryContent.split(/\n---+\n/).map((item) => item.trim()).filter(Boolean);
    const rows = Array.isArray(discussions)
      ? discussions.map((discussion, index) => ({
        ...discussion,
        summary: summaries[index] || summaries[0],
      }))
      : [{ ...discussions, summary: summaryContent }];
    const writeDiary = section === 'life'
      ? writeLifeRedditDiary
      : section === 'ai'
        ? writeAiRedditDiary
        : writeRedditDiary;
    const result = await writeDiary({
      diaryDir,
      today,
      discussions: rows,
    });
    console.log(`Reddit 热帖摘要写入完成: ${result.diaryPath}`);
    for (const row of rows) {
      console.log(`帖子: ${row.source?.name || 'Reddit'} ${row.post.title}`);
    }
    return;
  }

  console.log(JSON.stringify(discussions, null, 2));
  console.log('\n--- AI SUMMARY PROMPT ---\n');
  for (const discussion of discussions) {
    console.log(`\n## ${discussion.source.name}\n`);
    console.log(buildRedditSummaryPrompt({ ...discussion, terms }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(`Reddit 采集失败: ${error.message}`);
    process.exit(1);
  });
}
