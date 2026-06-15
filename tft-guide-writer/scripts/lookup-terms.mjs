#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = join(scriptDir, '..');
const termsDir = join(skillDir, 'references', 'terms');

const tables = {
  zh: { file: 'zh_terms.csv', label: 'zh_terms' },
  en: { file: 'en_to_zh.csv', label: 'en_to_zh' },
  jp: { file: 'jp_to_zh.csv', label: 'jp_to_zh' },
  ocr: { file: '误识别映射表.csv', label: 'misrecognition' },
};

const args = process.argv.slice(2);

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/lookup-terms.mjs <query> [--table all|zh|en|jp|ocr] [--limit N]

Examples:
  node scripts/lookup-terms.mjs variation --table en
  node scripts/lookup-terms.mjs 木格子 --table ocr
  node scripts/lookup-terms.mjs 观星者 --table all`);
  process.exit(exitCode);
}

function takeOption(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    process.exit(2);
  }
  args.splice(index, 2);
  return value;
}

if (args.includes('--help') || args.includes('-h')) {
  usage(0);
}

const tableArg = takeOption('--table', 'all');
const limitArg = takeOption('--limit', '30');
const limit = Number.parseInt(limitArg, 10);

if (!Number.isInteger(limit) || limit < 1) {
  console.error('--limit must be a positive integer');
  process.exit(2);
}

const query = args.join(' ').trim();
if (!query) {
  usage(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item.trim() !== ''));
}

function formatRow(tableKey, row, index) {
  if (tableKey === 'zh') {
    return `${tables[tableKey].label}:${index + 1}: ${row[0]}`;
  }

  if (tableKey === 'ocr') {
    const [source, target, note, type] = row;
    return `${tables[tableKey].label}:${index + 1}: ${source} -> ${target} (${type || ''}${note ? `, ${note}` : ''})`;
  }

  const [source, target] = row;
  return `${tables[tableKey].label}:${index + 1}: ${source} -> ${target}`;
}

const selectedTables = tableArg === 'all' ? Object.keys(tables) : [tableArg];
for (const table of selectedTables) {
  if (!tables[table]) {
    console.error(`Unknown table: ${tableArg}`);
    usage(2);
  }
}

const queryLower = query.toLowerCase();
const matches = [];

for (const table of selectedTables) {
  const path = join(termsDir, tables[table].file);
  const rows = parseCsv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const dataRows = rows[0]?.some((cell) => /source|target|术语|原文|正确术语/i.test(cell))
    ? rows.slice(1)
    : rows;

  dataRows.forEach((row, index) => {
    if (row.some((cell) => cell.toLowerCase().includes(queryLower))) {
      matches.push(formatRow(table, row, index));
    }
  });
}

if (matches.length === 0) {
  console.log(`No matches for: ${query}`);
  process.exit(1);
}

for (const line of matches.slice(0, limit)) {
  console.log(line);
}

if (matches.length > limit) {
  console.log(`... ${matches.length - limit} more matches. Increase --limit to show more.`);
}
