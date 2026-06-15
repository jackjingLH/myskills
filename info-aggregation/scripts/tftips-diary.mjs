import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTableSection, upsertTableSection } from './diary-table.mjs';
import { readDiaryOrTemplate } from './diary-template.mjs';

const CONFIG = {
  baseUrl: 'https://tftips.app',
  compsUrl: 'https://tftips.app/comps',
  requestTimeout: 30000,
};

const TFTIPS_CLEAR_ITEMS = [{
  platform: 'TFTips',
  author: 'TFTips',
}];

export function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(year, month, day) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function extractUpdateDate(html) {
  const updateMatch = html.match(/Updated:\s*(?:<!--\s*-->)?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!updateMatch) return null;

  return toIsoDate(
    Number.parseInt(updateMatch[1], 10),
    Number.parseInt(updateMatch[2], 10),
    Number.parseInt(updateMatch[3], 10),
  );
}

export function extractTags(cardHtml) {
  const tagRegex = /<div class="inline-flex[^"]*rounded-full border[^"]*"[^>]*>\s*([^<]+?)\s*<\/div>/g;
  const seen = new Set();

  for (const match of cardHtml.matchAll(tagRegex)) {
    const tag = cleanText(match[1]);
    if (tag) seen.add(tag);
  }

  return seen.size > 0 ? [...seen].join(' / ') : 'TFTips 阵容推荐';
}

export function parseComps(html) {
  const comps = [];
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
  const sections = [...html.matchAll(sectionRegex)];

  for (const sectionMatch of sections) {
    const sectionHtml = sectionMatch[1];
    const tierMatch = sectionHtml.match(/class="[^"]*bg-tier-([sabc])[^"]*"/i);
    const tier = tierMatch ? tierMatch[1].toUpperCase() : '未分级';
    const cardRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const cards = [...sectionHtml.matchAll(cardRegex)];

    for (const card of cards) {
      const href = card[1];
      const cardHtml = card[2];
      const titleMatch = cardHtml.match(/<h3[^>]*>(.*?)<\/h3>/);
      if (!titleMatch) continue;

      const slugMatch = href.match(/\/comps\/([^?#]+)/);
      if (!slugMatch) continue;

      const imgMatch = cardHtml.match(/<img[^>]+src="([^"]+)"/);
      const thumbnail = imgMatch ? imgMatch[1].replace('/champ/sm/', '/champ/md/') : '';
      const link = href.startsWith('http') ? href : `${CONFIG.baseUrl}${href}`;
      const slug = slugMatch[1];

      comps.push({
        id: `TFTips-${slug}`,
        title: cleanText(titleMatch[1]),
        description: extractTags(cardHtml),
        link,
        thumbnail,
        platform: 'TFTips',
        author: 'TFTips',
        category: tier,
        updatedDate: extractUpdateDate(cardHtml),
      });
    }
  }

  return comps;
}

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

export function filterRecentComps(comps, today = getShanghaiToday()) {
  const allowedDates = new Set([shiftDate(today, -1)]);
  return comps
    .filter((comp) => comp.updatedDate && allowedDates.has(comp.updatedDate))
    .sort((a, b) => {
      const byDate = b.updatedDate.localeCompare(a.updatedDate);
      if (byDate !== 0) return byDate;
      return String(a.title).localeCompare(String(b.title));
    });
}

export function renderDiarySection(comps, today = getShanghaiToday()) {
  if (comps.length === 0) {
    return renderTableSection([], today);
  }

  return renderTableSection(comps.map((comp) => ({
    module: 'TFT',
    platform: comp.platform,
    author: `[${comp.author}](${CONFIG.compsUrl})`,
    sourceUrl: CONFIG.compsUrl,
    title: `[${comp.title}](${comp.link})`,
    description: `描述：${comp.updatedDate} 更新。分级：${comp.category}。标签：${comp.description}。`,
  })), today);
}

function buildFetchFailureItem(today, error) {
  return {
    kind: 'failure',
    platform: 'TFTips',
    author: `[TFTips](${CONFIG.compsUrl})`,
    description: `${today} 检查昨天，TFTips 获取失败：${formatErrorMessage(error)}，未确认是否有更新。`,
  };
}

export function upsertSection(markdown, section) {
  return upsertTableSection(markdown, sectionToItems(section), extractDate(section), TFTIPS_CLEAR_ITEMS);
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

export function fetchHtml(url = CONFIG.compsUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      },
      timeout: CONFIG.requestTimeout,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

export function formatErrorMessage(error) {
  if (error instanceof AggregateError && error.errors?.length > 0) {
    return error.errors.map(formatErrorMessage).join('; ');
  }

  const code = error?.code ? `${error.code}: ` : '';
  const message = error?.message || String(error);
  return `${code}${message}`;
}

export async function writeTftipsDiary({
  diaryDir = path.resolve('10 日记'),
  today = getShanghaiToday(),
  fetchHtmlFn = fetchHtml,
} = {}) {
  const tableItems = [];
  let comps = [];

  try {
    const html = await fetchHtmlFn();
    comps = filterRecentComps(parseComps(html), today);
    tableItems.push(...sectionToItems(renderDiarySection(comps, today)));
  } catch (error) {
    tableItems.push(buildFetchFailureItem(today, error));
  }

  const diaryPath = path.join(diaryDir, `${today}.md`);
  const current = await readDiaryOrTemplate(diaryPath, today);

  const next = upsertTableSection(current, tableItems, today, TFTIPS_CLEAR_ITEMS);
  await fs.mkdir(path.dirname(diaryPath), { recursive: true });
  await fs.writeFile(diaryPath, `${next.trimEnd()}\n`, 'utf8');

  return { diaryPath, count: comps.length, comps };
}

async function main() {
  const todayArg = process.argv.find((arg) => arg.startsWith('--date='));
  const diaryDirArg = process.argv.find((arg) => arg.startsWith('--diary-dir='));
  const today = todayArg ? todayArg.slice('--date='.length) : getShanghaiToday();
  const diaryDir = diaryDirArg ? diaryDirArg.slice('--diary-dir='.length) : path.resolve('10 日记');
  const result = await writeTftipsDiary({ diaryDir, today });

  console.log(`TFTips 写入完成: ${result.diaryPath}`);
  console.log(`昨天更新数量: ${result.count}`);
  for (const comp of result.comps) {
    console.log(`- ${comp.updatedDate} ${comp.title} ${comp.link}`);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
