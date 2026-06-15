import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTableSection, upsertTableSection } from './diary-table.mjs';
import { readDiaryOrTemplate } from './diary-template.mjs';

const currentFile = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(currentFile);
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DIARY_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..');
const DEFAULT_TERMS_FILE = path.resolve(SKILL_DIR, 'references', 'terms', 'en_to_zh.csv');
const DEFAULT_PROFILE_DIR = 'D:\\tmp\\chrome-cdp-profile';

const CONFIG = {
  profileDir: DEFAULT_PROFILE_DIR,
  navigationTimeout: 45000,
  sourceWaitTimeout: 20000,
};

function resolveFixedProfileDir(profileDir = DEFAULT_PROFILE_DIR) {
  const actual = path.normalize(profileDir).toLowerCase();
  const expected = path.normalize(DEFAULT_PROFILE_DIR).toLowerCase();
  if (actual !== expected) {
    throw new Error(`浏览器 profile 必须使用固定目录 ${DEFAULT_PROFILE_DIR}，当前为 ${profileDir}`);
  }
  return DEFAULT_PROFILE_DIR;
}

function getSystemChromeCandidates() {
  return [
    process.env.INFO_AGG_CHROME_EXECUTABLE,
    'C:\\Users\\jinglihao\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
}

export async function resolveSystemChromeExecutable({ accessFn = fs.access, candidates = getSystemChromeCandidates() } = {}) {
  for (const candidate of candidates) {
    try {
      await accessFn(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    '未找到系统 Chrome 可执行文件。请设置 INFO_AGG_CHROME_EXECUTABLE，或确认 Chrome 安装在常见路径下。',
  );
}

export const BROWSER_SOURCES = [
  {
    platform: 'YouTube',
    name: 'LearningTFT',
    handle: '@LearningTFT',
    url: 'https://www.youtube.com/@LearningTFT/videos',
  },
  {
    platform: 'YouTube',
    name: 'Yi Is Yordle TFT',
    handle: '@YiIsYordleTFT',
    url: 'https://www.youtube.com/@YiIsYordleTFT/videos',
  },
  {
    platform: 'Tacter',
    name: 'TFTtomus',
    handle: '@tfttomus',
    url: 'https://www.tacter.com/@tfttomus',
  },
  {
    platform: 'Tacter',
    name: 'ExTIRIA',
    handle: '@extiria',
    url: 'https://www.tacter.com/@extiria',
  },
];

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getShanghaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getSourcePageUrl(source) {
  if (source.url) return source.url;
  if (source.platform === 'YouTube' && source.handle) {
    return `https://www.youtube.com/${source.handle}/videos`;
  }
  throw new Error(`缺少浏览器采集地址: ${source.platform} ${source.name || ''}`.trim());
}

function inferYouTubeHandle(url) {
  const match = String(url).match(/youtube\.com\/(@[^/?#]+)/);
  return match ? match[1] : '';
}

export function buildCliSource({ url, source }) {
  if (!url) return null;
  const handle = inferYouTubeHandle(url);
  return {
    platform: 'YouTube',
    name: source || handle || 'YouTube',
    handle,
    url,
  };
}

export function parseRelativeDate(text = '', today = getShanghaiToday()) {
  const value = String(text).toLowerCase();
  const rules = [
    { pattern: /(\d+)\s*(?:minute|minutes|min|mins)\s+ago/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*(?:hour|hours|hr|hrs)\s+ago/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*(?:day|days)\s+ago/, unit: 'day', multiplier: 1 },
    { pattern: /(\d+)\s*(?:week|weeks)\s+ago/, unit: 'day', multiplier: 7 },
    { pattern: /(\d+)\s*m\s+ago/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*h\s+ago/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*d\s+ago/, unit: 'day', multiplier: 1 },
    { pattern: /(\d+)\s*w\s+ago/, unit: 'day', multiplier: 7 },
    { pattern: /(\d+)\s*mo\s+ago/, unit: 'day', multiplier: 30 },
    { pattern: /(\d+)\s*分钟前/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*小时前/, unit: 'day', multiplier: 0 },
    { pattern: /(\d+)\s*天前/, unit: 'day', multiplier: 1 },
    { pattern: /(\d+)\s*周前/, unit: 'day', multiplier: 7 },
  ];

  for (const rule of rules) {
    const match = value.match(rule.pattern);
    if (match) {
      const amount = Number.parseInt(match[1], 10) * rule.multiplier;
      return shiftDate(today, -amount);
    }
  }

  if (/\byesterday\b|昨天/.test(value)) return shiftDate(today, -1);
  if (/\btoday\b|刚刚|今天/.test(value)) return today;
  return null;
}

function normalizeUrl(link, source) {
  if (!link) return '';
  if (link.startsWith('http')) return link;
  if (source?.platform === 'Tacter' && link.startsWith('/')) return `https://www.tacter.com${link}`;
  if (link.startsWith('/')) return `https://www.youtube.com${link}`;
  return link;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
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

export async function loadEnglishTermMappings(termsFile = DEFAULT_TERMS_FILE) {
  const content = await fs.readFile(termsFile, 'utf8');
  return content
    .split(/\r?\n/)
    .slice(1)
    .map(parseCsvLine)
    .map(([source, target]) => ({ source, target }))
    .filter((term) => term.source && term.target);
}

function displayMarkdownLink(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  return match ? { title: match[1], url: match[2] } : { title: text, url: '' };
}

function selectRelevantTerms(text, terms, limit = 100) {
  const haystack = String(text || '').toLowerCase();
  const selected = [];
  const seen = new Set();

  for (const term of terms) {
    const source = String(term.source || '').trim();
    const target = String(term.target || '').trim();
    if (!source || !target || seen.has(source.toLowerCase())) continue;
    if (haystack.includes(source.toLowerCase())) {
      selected.push({ source, target });
      seen.add(source.toLowerCase());
    }
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildTacterSummaryPrompt({ source, item, content, terms = [] }) {
  const link = displayMarkdownLink(item?.title);
  const relevantTerms = selectRelevantTerms(`${link.title}\n${content}`, terms);
  const termLines = relevantTerms.length > 0
    ? relevantTerms.map((term) => `- ${term.source} => ${term.target}`)
    : ['- 未命中术语映射；保留 TFT 专有名词，不要自行乱译英雄、特质、装备名。'];

  return [
    `请用中文输出 Tacter 作者 ${source?.name || item?.author || '未知作者'} 的 TFT 攻略总结。`,
    '',
    '要求：',
    '- 先根据术语映射在内部完成英文术语到中文术语的统一翻译，再进行总结。',
    '- 总结阵容核心、主C/副C、装备选择、强化符文、运营节奏、成型等级、站位或变阵要点。',
    '- 输出 3-6 条 Markdown bullet，不要输出完整逐句翻译。',
    '- 游戏术语必须优先使用术语表译名；术语表没有的英雄、特质、装备名保留原文。',
    '',
    '术语映射：',
    ...termLines,
    '',
    '攻略：',
    `标题：${link.title}`,
    `链接：${link.url}`,
    '',
    '正文：',
    String(content || '未提取到正文。').slice(0, 12000),
  ].join('\n');
}

export function normalizeBrowserItem(rawItem, source, today = getShanghaiToday()) {
  const title = String(rawItem.title || '').replace(/\s+/g, ' ').trim();
  const link = normalizeUrl(String(rawItem.link || '').trim(), source);
  const publishedDate = rawItem.publishedDate || parseRelativeDate(rawItem.metadataText || '', today);

  if (!title || !link) return null;

  return {
    module: 'TFT',
    platform: source.platform,
    author: source.name,
    sourceUrl: source.url,
    title: `[${title}](${link})`,
    description: `${source.name}｜${publishedDate || '发布时间未识别'} 发布`,
    publishedDate,
  };
}

export function filterRecentBrowserItems(items, today = getShanghaiToday()) {
  const allowedDates = new Set([shiftDate(today, -1)]);

  return items
    .filter((item) => item.publishedDate && allowedDates.has(item.publishedDate))
    .sort((a, b) => {
      const byDate = b.publishedDate.localeCompare(a.publishedDate);
      if (byDate !== 0) return byDate;
      return String(a.title).localeCompare(String(b.title));
    });
}

export function renderBrowserDiarySection(items, today = getShanghaiToday()) {
  return renderTableSection(items, today);
}

export function buildClearItems(sources = BROWSER_SOURCES) {
  const platforms = new Set(sources.map((source) => source.platform));
  return [...platforms].map((platform) => ({ platform }));
}

function sectionToItems(section) {
  const rows = [];
  let currentPlatform = '';
  let inFailureSection = false;

  for (const line of section.split(/\r?\n/)) {
    const platformMatch = line.match(/^####\s+(.+?)\s*$/);
    if (platformMatch) {
      currentPlatform = platformMatch[1];
      inFailureSection = false;
      continue;
    }

    if (line.match(/^###\s+失败\s*$/)) {
      inFailureSection = true;
      continue;
    }

    if (!line.startsWith('- ')) continue;

    if (!inFailureSection) {
      const taskText = line.replace(/^- (?:\[[ xX]\]\s+)?/, '').trim();
      if (!taskText.includes('｜')) {
        if (currentPlatform) {
          rows.push({
            kind: 'content',
            platform: currentPlatform,
            author: '',
            title: taskText,
            description: '',
          });
        }
      } else {
        const cells = taskText.split('｜').map((cell) => cell.trim());
        rows.push({
          kind: 'content',
          platform: cells[0],
          author: cells[1],
          title: cells[2],
          description: cells.slice(3).join('｜'),
        });
      }
    } else {
      const cells = line.replace(/^- /, '').split('｜').map((cell) => cell.trim());
      rows.push({
        kind: 'failure',
        platform: cells[0],
        author: cells[1],
        description: cells.slice(2).join('｜'),
      });
    }
  }

  return rows;
}

function extractDate(section) {
  const match = section.match(/检索日期：(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : getShanghaiToday();
}

export function upsertBrowserSection(markdown, section, clearItems = buildClearItems()) {
  return upsertTableSection(markdown, sectionToItems(section), extractDate(section), clearItems);
}

export function formatErrorMessage(error) {
  const code = error?.code ? `${error.code}: ` : '';
  const message = error?.message || String(error);
  return `${code}${message}`;
}

function buildFailureItem(source, today, error) {
  const author = source.url
    ? `[${source.name}](${source.url})`
    : source.handle
    ? `[${source.name}](https://www.youtube.com/${source.handle})`
    : source.name;
  return {
    kind: 'failure',
    platform: source.platform,
    author,
    description: `${today} 浏览器采集失败：${formatErrorMessage(error)}。`,
  };
}

async function loadChromium(useStealth = true) {
  if (useStealth) {
    try {
      const playwrightExtra = await import('playwright-extra');
      const stealthImport = await import('puppeteer-extra-plugin-stealth');
      const stealth = stealthImport.default || stealthImport;
      const chromium = playwrightExtra.chromium;
      chromium.use(stealth());
      return { chromium, stealthEnabled: true };
    } catch {
      // Optional dependency. Fall back to plain Playwright below.
    }
  }

  try {
    const playwright = await import('playwright');
    return { chromium: playwright.chromium, stealthEnabled: false };
  } catch (error) {
    throw new Error(`缺少 Playwright 运行依赖。请在可运行脚本的 Node 项目中安装 playwright，或设置好全局依赖后重试。原始错误：${error.message}`);
  }
}

async function extractYouTubeCards(page) {
  await page.waitForSelector('a[href*="/watch"], a#video-title, ytd-rich-grid-media a#video-title, ytd-video-renderer a#video-title', {
    timeout: CONFIG.sourceWaitTimeout,
  });

  for (let index = 0; index < 4; index++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(700);
  }

  return page.evaluate(() => {
    const pickTitle = (anchor, container) => {
      const direct = (anchor.getAttribute('title') || anchor.getAttribute('aria-label') || anchor.textContent || '').trim().split('\n')[0].trim();
      if (direct && !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(direct)) return direct;

      const lines = (container?.innerText || '').split('\n').map((line) => line.trim()).filter(Boolean);
      return lines.find((line) => {
        if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(line)) return false;
        if (/^\d+(\.\d+)?[万千]?\s*(?:次观看|views)$/i.test(line)) return false;
        if (/^\d+\s*(?:分钟前|小时前|天前|周前|months? ago|years? ago|minutes? ago|hours? ago|days? ago|weeks? ago)$/i.test(line)) return false;
        return true;
      }) || direct;
    };

    const anchors = [...document.querySelectorAll('a#video-title, ytd-rich-grid-media a#video-title, ytd-video-renderer a#video-title, a[href*="/watch"]')];
    const seen = new Set();
    return anchors.map((anchor) => {
      const container = anchor.closest('ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer') || anchor.parentElement;
      const title = pickTitle(anchor, container);
      const link = anchor.getAttribute('href') || '';
      const metadataText = container?.innerText || anchor.parentElement?.innerText || '';
      return { title, link, metadataText };
    }).filter((item) => {
      const key = `${item.title}\n${item.link}`;
      if (!item.title || !item.link || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

async function extractTacterCards(page) {
  await page.waitForSelector('a[href*="/tft/guides/"]', {
    timeout: CONFIG.sourceWaitTimeout,
  });

  for (let index = 0; index < 3; index++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(700);
  }

  return page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href*="/tft/guides/"]')];
    const seen = new Set();

    return anchors.map((anchor) => {
      const heading = anchor.querySelector('h3');
      const title = (heading?.textContent || '').trim();
      const link = anchor.getAttribute('href') || '';
      const metadataText = anchor.innerText || '';
      return { title, link, metadataText };
    }).filter((item) => {
      const key = item.link.split('?')[0];
      if (!item.title || !item.link || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

async function extractTacterGuideContent(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: CONFIG.navigationTimeout,
  });

  await page.waitForSelector('body', {
    timeout: CONFIG.sourceWaitTimeout,
  });

  for (let index = 0; index < 3; index++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(500);
  }

  return page.evaluate(() => {
    const root = document.querySelector('main, article') || document.body;
    const lines = (root?.innerText || '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => {
        if (!line) return false;
        if (/^(sign in|log in|search|share|copy link)$/i.test(line)) return false;
        if (/^ADVERTISEMENT$/i.test(line)) return false;
        return true;
      });
    return [...new Set(lines)].join('\n').slice(0, 16000);
  });
}

async function extractSourceItems(context, source, today) {
  const page = await context.newPage();
  try {
    await page.goto(getSourcePageUrl(source), {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.navigationTimeout,
    });

    const rawItems = source.platform === 'YouTube'
      ? await extractYouTubeCards(page)
      : source.platform === 'Tacter'
        ? await extractTacterCards(page)
        : [];

    return rawItems
      .map((rawItem) => normalizeBrowserItem(rawItem, source, today))
      .filter(Boolean);
  } finally {
    await page.close();
  }
}

export async function collectTacterDiscussions({
  sources = BROWSER_SOURCES.filter((source) => source.platform === 'Tacter'),
  today = getShanghaiToday(),
  profileDir = CONFIG.profileDir,
  headless = false,
  useStealth = true,
  cdpEndpoint,
} = {}) {
  const tacterSources = sources.filter((source) => source.platform === 'Tacter');
  if (tacterSources.length === 0) {
    throw new Error('Tacter 总结需要选择 Tacter 来源。');
  }

  const session = await openBrowserSession({
    profileDir,
    headless,
    useStealth,
    cdpEndpoint,
  });

  const discussions = [];
  try {
    for (const source of tacterSources) {
      const sourceItems = await extractSourceItems(session.context, source, today);
      const recentItems = filterRecentBrowserItems(sourceItems, today);
      for (const item of recentItems) {
        const page = await session.context.newPage();
        try {
          const { url } = displayMarkdownLink(item.title);
          const content = await extractTacterGuideContent(page, url);
          discussions.push({ source, item, content });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await session.close();
  }

  return discussions;
}

async function openBrowserSession({
  profileDir,
  headless,
  useStealth,
  cdpEndpoint,
}) {
  if (cdpEndpoint) {
    const { chromium } = await import('playwright');
    const browser = await chromium.connectOverCDP(cdpEndpoint);
    const context = browser.contexts()[0] || await browser.newContext({
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      viewport: { width: 1440, height: 1000 },
    });

    return {
      context,
      stealthEnabled: false,
      close: async () => {
        await browser.close();
      },
    };
  }

  const { chromium, stealthEnabled } = await loadChromium(useStealth);
  const executablePath = await resolveSystemChromeExecutable();
  await fs.mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 1000 },
  });

  return {
    context,
    stealthEnabled,
    close: async () => {
      await context.close();
    },
  };
}

export async function collectBrowserItems({
  sources = BROWSER_SOURCES,
  today = getShanghaiToday(),
  profileDir = CONFIG.profileDir,
  headless = false,
  useStealth = true,
  cdpEndpoint,
} = {}) {
  const session = await openBrowserSession({
    profileDir,
    headless,
    useStealth,
    cdpEndpoint,
  });

  const items = [];
  const failures = [];

  try {
    for (const source of sources) {
      try {
        const sourceItems = await extractSourceItems(session.context, source, today);
        items.push(...filterRecentBrowserItems(sourceItems, today));
      } catch (error) {
        failures.push(buildFailureItem(source, today, error));
      }
    }
  } finally {
    await session.close();
  }

  return { items, failures, stealthEnabled: session.stealthEnabled, profileDir };
}

export async function writeBrowserDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  sources = BROWSER_SOURCES,
  profileDir = CONFIG.profileDir,
  headless = false,
  useStealth = true,
  cdpEndpoint,
} = {}) {
  const { items, failures, stealthEnabled } = await collectBrowserItems({
    sources,
    today,
    profileDir,
    headless,
    useStealth,
    cdpEndpoint,
  });

  const tableItems = [...items, ...failures];
  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);

  const next = upsertTableSection(current, tableItems, today, buildClearItems(sources));
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');

  return { diaryPath, count: items.length, items, failures, stealthEnabled };
}

export async function writeTacterSummaryDiary({
  diaryDir = DEFAULT_DIARY_DIR,
  today = getShanghaiToday(),
  discussions = [],
  summaries = [],
} = {}) {
  if (discussions.some((discussion) => !discussion.item)) throw new Error('缺少 Tacter 攻略数据。');
  if (discussions.length > 0 && summaries.length === 0) throw new Error('缺少 Tacter 中文总结。');

  const items = discussions.map((discussion, index) => ({
    ...discussion.item,
    module: discussion.item.module || 'TFT',
    sourceUrl: discussion.item.sourceUrl || discussion.source?.url,
    summary: summaries[index] || summaries[0],
  }));
  const clearItems = buildClearItems(discussions.map((discussion) => discussion.source));
  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);
  const next = upsertTableSection(current, items, today, clearItems);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');
  return { diaryPath, count: items.length, items };
}

export function buildRuntimeOptions(argv) {
  const getValue = (...names) => {
    for (const name of names) {
      const arg = argv.find((item) => item.startsWith(`--${name}=`));
      if (arg) return arg.slice(name.length + 3);
    }
    return undefined;
  };

  const sourceName = getValue('source');
  const url = getValue('url');
  const cliSource = buildCliSource({ url, source: sourceName });
  const sources = cliSource
    ? [cliSource]
    : sourceName
      ? BROWSER_SOURCES.filter((source) => {
        const value = sourceName.toLowerCase();
        return source.name.toLowerCase() === value || source.platform.toLowerCase() === value;
      })
      : BROWSER_SOURCES;

  if (!cliSource && sourceName && sources.length === 0) {
    throw new Error(`未知浏览器采集来源: ${sourceName}`);
  }

  return {
    today: getValue('date') || getShanghaiToday(),
    diaryDir: getValue('diary-dir') || DEFAULT_DIARY_DIR,
    profileDir: resolveFixedProfileDir(getValue('user-data-dir', 'profile-dir') || CONFIG.profileDir),
    termsFile: getValue('terms-file') || DEFAULT_TERMS_FILE,
    summaryFile: getValue('summary-file'),
    discussionFile: getValue('discussion-file'),
    outputDiscussionFile: getValue('output-discussion'),
    headless: argv.includes('--headless'),
    useStealth: !argv.includes('--no-stealth'),
    cdpEndpoint: getValue('cdp'),
    sources,
  };
}

async function main() {
  const options = buildRuntimeOptions(process.argv.slice(2));
  if (options.outputDiscussionFile || options.discussionFile || options.summaryFile) {
    const discussions = options.discussionFile
      ? JSON.parse(await fs.readFile(options.discussionFile, 'utf8'))
      : await collectTacterDiscussions(options);

    if (options.outputDiscussionFile) {
      await fs.mkdir(path.dirname(options.outputDiscussionFile), { recursive: true });
      await fs.writeFile(options.outputDiscussionFile, `${JSON.stringify(discussions, null, 2)}\n`, 'utf8');
    }

    if (options.summaryFile) {
      const summaryContent = await fs.readFile(options.summaryFile, 'utf8');
      const summaries = summaryContent.split(/\n---+\n/).map((item) => item.trim()).filter(Boolean);
      const result = await writeTacterSummaryDiary({
        diaryDir: options.diaryDir,
        today: options.today,
        discussions,
        summaries,
      });
      console.log(`Tacter 攻略摘要写入完成: ${result.diaryPath}`);
      console.log(`攻略数量: ${result.count}`);
      return;
    }

    const terms = await loadEnglishTermMappings(options.termsFile);
    console.log('\n--- AI SUMMARY PROMPT ---\n');
    for (const discussion of discussions) {
      console.log(buildTacterSummaryPrompt({ ...discussion, terms }));
      console.log('\n---\n');
    }
    return;
  }

  const result = await writeBrowserDiary(options);
  console.log(`浏览器采集写入完成: ${result.diaryPath}`);
  console.log(`昨天更新数量: ${result.count}`);
  console.log(`Stealth: ${result.stealthEnabled ? 'enabled' : 'disabled'}`);
  for (const item of result.items) {
    console.log(`- ${item.platform} ${item.author} ${item.title}`);
  }
  for (const failure of result.failures) {
    console.log(`- ${failure.author} ${failure.description}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(`浏览器采集失败: ${formatErrorMessage(error)}`);
    process.exit(1);
  });
}
