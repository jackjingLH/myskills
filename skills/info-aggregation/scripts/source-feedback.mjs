import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getShanghaiToday } from './browser-diary.mjs';

const currentFile = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(currentFile);
const DEFAULT_DIARY_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..');

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesInRange(from, to) {
  const dates = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function isTopLevelBoundary(line) {
  return /^#{2,4}\s+/.test(line) || /^- /.test(line);
}

function parseSourceMeta(line = '') {
  const match = line.match(/^\s*%%\s*source:\s*(.*?)\s*%%\s*$/);
  if (!match) return null;
  const [module = '', platform = '', name = '', url = ''] = match[1].split('|').map((part) => part.trim());
  if (!platform && !name) return null;
  return { module, platform, name, url };
}

function sourceKey(source) {
  return [source.module, source.platform, source.name, source.url].join('|');
}

function sourceLabel(source) {
  return [source.module, source.platform, source.name].filter(Boolean).join(' / ');
}

export function collectFeedbackFromMarkdown(markdown, date = '') {
  const rows = [];
  const lines = String(markdown || '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^- /.test(lines[index])) continue;

    let source = null;
    let done = /^- \[[xX]\]\s+/.test(lines[index]);

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (isTopLevelBoundary(line)) break;

      source = parseSourceMeta(line) || source;
    }

    if (!source) continue;
    rows.push({ date, source, done });
  }

  return rows;
}

export async function collectFeedbackFromDiaries({
  diaryDir = DEFAULT_DIARY_DIR,
  from = shiftDate(getShanghaiToday(), -30),
  to = getShanghaiToday(),
} = {}) {
  const rows = [];
  for (const date of datesInRange(from, to)) {
    const diaryPath = path.join(diaryDir, `${date}.md`);
    try {
      const markdown = await fs.readFile(diaryPath, 'utf8');
      rows.push(...collectFeedbackFromMarkdown(markdown, date));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return rows;
}

export function summarizeFeedback(rows = []) {
  const summary = new Map();

  for (const row of rows) {
    const key = sourceKey(row.source);
    if (!summary.has(key)) {
      summary.set(key, {
        ...row.source,
        label: sourceLabel(row.source),
        total: 0,
        processed: 0,
        unprocessed: 0,
        lastSeen: '',
      });
    }

    const item = summary.get(key);
    item.total += 1;
    const processed = Boolean(row.done);
    if (processed) {
      item.processed += 1;
    } else {
      item.unprocessed += 1;
    }
    item.lastSeen = row.date || item.lastSeen;
  }

  return [...summary.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return String(b.lastSeen).localeCompare(String(a.lastSeen));
  });
}

export function renderFeedbackSummary(rows = []) {
  const header = '| 来源 | 命中 | 已处理 | 未处理 | 最近命中 |';
  const divider = '| --- | ---: | ---: | ---: | --- |';
  const body = rows.map((row) => {
    return `| ${row.label} | ${row.total} | ${row.processed} | ${row.unprocessed} | ${row.lastSeen || '无'} |`;
  });
  return [header, divider, ...(body.length > 0 ? body : ['| 无 | 0 | 0 | 0 | 无 |'])].join('\n');
}

function getArg(argv, name) {
  const arg = argv.find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const today = getShanghaiToday();
  const from = getArg(argv, 'from') || shiftDate(today, -30);
  const to = getArg(argv, 'to') || today;
  const diaryDir = getArg(argv, 'diary-dir') || DEFAULT_DIARY_DIR;
  const rows = await collectFeedbackFromDiaries({ diaryDir, from, to });
  console.log(renderFeedbackSummary(summarizeFeedback(rows)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(`来源反馈统计失败: ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}
