import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { marked } from 'marked';
import { chromium } from 'playwright';

import {
  PAGE_CONFIG,
  buildPagedCss,
} from './styles/officialCompact.js';

import {
  formatCheckReport,
  parsePagedMarkdown,
  validateMeasuredPages,
} from './pagedMarkdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tftRoot = path.resolve(__dirname, '../..');

const DEFAULT_OUTPUT_DIR = path.join(tftRoot, 'output');
const PAGE_MARKER_LINE_RE = /^[ \t]*<!--\s*tft-page:\s*\d+[^>]*-->\s*(?:\r?\n)?/gmi;
const PLAN_CANDIDATE_LIMIT = 8;
const PLAN_HEADING_ORPHAN_PENALTY = 900000;
const PLAN_BREAK_BEFORE_HEADING_BONUS = 12000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBrowserExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveMarkdownPath(inputPath) {
  const candidates = [];

  if (path.isAbsolute(inputPath)) {
    candidates.push(inputPath);
  } else {
    candidates.push(path.resolve(process.cwd(), inputPath));
    candidates.push(path.resolve(tftRoot, inputPath));
  }

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Paged markdown file not found: ${inputPath}`);
  }

  return found;
}

function cleanOutputDir(outputDir) {
  const resolvedOutputDir = path.resolve(outputDir);
  const root = path.parse(resolvedOutputDir).root;
  if (resolvedOutputDir === root || resolvedOutputDir.length <= root.length + 2) {
    throw new Error(`Refusing to clean unsafe output directory: ${resolvedOutputDir}`);
  }

  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  for (const entry of fs.readdirSync(resolvedOutputDir)) {
    fs.rmSync(path.join(resolvedOutputDir, entry), { recursive: true, force: true });
  }
}

function findObsidianVaultRoot(startDir) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(currentDir, '.obsidian'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function readObsidianAttachmentFolder(vaultRoot) {
  if (!vaultRoot) {
    return null;
  }

  const appConfigPath = path.join(vaultRoot, '.obsidian', 'app.json');
  if (!fs.existsSync(appConfigPath)) {
    return null;
  }

  try {
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    return typeof appConfig.attachmentFolderPath === 'string'
      ? appConfig.attachmentFolderPath.trim() || null
      : null;
  } catch (_error) {
    return null;
  }
}

function resolveMarkdownImagePath(imagePath, mdDir) {
  if (!imagePath) {
    return null;
  }

  if (/^(https?:)?\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (path.isAbsolute(imagePath)) {
    return fs.existsSync(imagePath) ? imagePath : null;
  }

  const noteRelativePath = path.resolve(mdDir, imagePath);
  if (fs.existsSync(noteRelativePath)) {
    return noteRelativePath;
  }

  const vaultRoot = findObsidianVaultRoot(mdDir);
  const attachmentFolderPath = readObsidianAttachmentFolder(vaultRoot);
  if (vaultRoot && attachmentFolderPath) {
    const attachmentAbsolutePath = path.resolve(vaultRoot, attachmentFolderPath, imagePath);
    if (fs.existsSync(attachmentAbsolutePath)) {
      return attachmentAbsolutePath;
    }
  }

  return null;
}

function imagePathToFileUrl(imagePath) {
  return `file:///${imagePath.replace(/\\/g, '/')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseObsidianImageOptions(rawOptions) {
  const result = {
    alt: '',
    width: null,
    height: null,
  };

  for (const rawOption of rawOptions) {
    const option = String(rawOption || '').trim();
    if (!option) {
      continue;
    }

    const sizeMatch = option.match(/^(\d+)(?:x(\d+))?$/i);
    if (sizeMatch) {
      result.width = sizeMatch[1];
      result.height = sizeMatch[2] || null;
      continue;
    }

    if (!result.alt) {
      result.alt = option;
    }
  }

  return result;
}

function preprocessObsidianMarkdown(markdown) {
  return String(markdown).replace(/!\[\[([\s\S]+?)\]\]/g, (match, innerContent) => {
    const segments = String(innerContent)
      .split('|')
      .map((segment) => segment.trim());
    const sourcePath = segments.shift();
    if (!sourcePath) {
      return match;
    }

    const options = parseObsidianImageOptions(segments);
    const attrs = [
      `src="${escapeHtml(sourcePath)}"`,
      `alt="${escapeHtml(options.alt)}"`,
    ];
    if (options.width) {
      attrs.push(`width="${options.width}"`);
    }
    if (options.height) {
      attrs.push(`height="${options.height}"`);
    }

    return `<img ${attrs.join(' ')}>`;
  });
}

function resolveHtmlImageSources(htmlContent, mdDir) {
  return String(htmlContent).replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*?)>/gi, (match, beforeSrc, src, afterSrc) => {
    const resolvedPath = resolveMarkdownImagePath(src, mdDir);
    if (!resolvedPath || /^(https?:)?\/\//i.test(resolvedPath)) {
      return match;
    }

    return `<img${beforeSrc}src="${imagePathToFileUrl(resolvedPath)}"${afterSrc}>`;
  });
}

function normalizePropertyValue(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

function parseDelimitedList(value, delimiter = ',') {
  const normalized = normalizePropertyValue(value);
  if (!normalized) {
    return [];
  }

  const inlineArrayMatch = normalized.match(/^\[(.*)\]$/);
  const baseSource = inlineArrayMatch ? inlineArrayMatch[1] : normalized;
  const listSource = delimiter === '/'
    ? baseSource.replace(/\s*\/\s*/g, '/')
    : baseSource;

  return listSource
    .split(delimiter)
    .map((item) => normalizePropertyValue(item).replace(/^#/, '').trim())
    .filter(Boolean);
}

function normalizeCoverPath(value) {
  let coverPath = normalizePropertyValue(value);

  const wikiLinkMatch = coverPath.match(/^!?\[\[(.+?)\]\]$/);
  if (wikiLinkMatch) {
    coverPath = wikiLinkMatch[1].split('|')[0].trim();
  }

  return coverPath || null;
}

function stripBodyMetadataLines(bodyContent) {
  const cleaned = String(bodyContent)
    .replace(/(^|\r?\n)标签：[^\r\n]*(?=\r?\n|$)/, '$1')
    .replace(/(^|\r?\n)封面：[^\r\n]*(?=\r?\n|$)/, '$1')
    .replace(/\n{3,}/g, '\n\n');

  const lines = cleaned.split(/\r?\n/);
  const filteredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = lines[i + 1]?.trim() || '';

    if (/^来源：/.test(trimmedLine)) {
      filteredLines.push(line.replace(/\s+#\S+(?:\s+#\S+)*\s*$/, ''));
      if (/^#\S+(?:\s+#\S+)*$/.test(nextLine)) {
        i++;
      }
      continue;
    }

    filteredLines.push(line);
  }

  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function extractHeaderBodyMetadata(bodyContent) {
  const lines = String(bodyContent).split(/\r?\n/);
  const h1Index = lines.findIndex((line) => /^#\s+.+$/.test(line.trim()));

  if (h1Index === -1) {
    return {
      displayTags: [],
      cover: null,
    };
  }

  let scanIndex = h1Index + 1;
  while (scanIndex < lines.length && !lines[scanIndex].trim()) {
    scanIndex++;
  }

  const tagsLine = lines[scanIndex] || '';
  const coverLine = lines[scanIndex + 1] || '';

  const tagsMatch = tagsLine.match(/^标签：\s*(.*)$/);
  const coverMatch = coverLine.match(/^封面：\s*(.*)$/);

  return {
    displayTags: tagsMatch ? parseDelimitedList(tagsMatch[1], '/') : [],
    cover: coverMatch ? normalizeCoverPath(coverMatch[1]) : null,
  };
}

function resolveRenderableImageUrl(imagePath, mdDir) {
  if (!imagePath) {
    return null;
  }

  if (/^(https?:)?\/\//i.test(imagePath)) {
    return imagePath;
  }

  const resolvedPath = resolveMarkdownImagePath(imagePath, mdDir);
  if (!resolvedPath || /^(https?:)?\/\//i.test(resolvedPath)) {
    return null;
  }

  return imagePathToFileUrl(resolvedPath);
}

function buildTitleContainerHtml(titleHtml, displayTags, coverUrl) {
  let contentHtml = '';

  if (displayTags.length > 0) {
    contentHtml += '<div class="tags-container">';
    for (const tag of displayTags) {
      contentHtml += `<span class="tag">${tag}</span>`;
    }
    contentHtml += '</div>';
  }

  contentHtml += `<h1>${titleHtml}</h1>`;

  if (coverUrl) {
    contentHtml += `<img class="cover-image" src="${escapeHtml(coverUrl)}" alt="封面图">`;
  }

  return `<div class="h1-container">${contentHtml}</div>`;
}

function injectTitleContainer(htmlContent, displayTags, coverUrl) {
  return String(htmlContent).replace(/<h1>([\s\S]*?)<\/h1>/i, (match, titleHtml) => buildTitleContainerHtml(titleHtml, displayTags, coverUrl));
}

function renderMarkdownBodyToHtml(markdownBody, mdDir) {
  const renderer = new marked.Renderer();
  const html = marked(preprocessObsidianMarkdown(markdownBody), { renderer });
  return resolveHtmlImageSources(html, mdDir);
}

function buildPagedHtml(parsed, mdDir) {
  const h1BackgroundImagePath = fs.existsSync(path.join(__dirname, 'bg.png'))
    ? imagePathToFileUrl(path.join(__dirname, 'bg.png'))
    : '';

  const pageHtml = parsed.pages.map((page) => {
    const strippedBody = stripBodyMetadataLines(page.body);
    const html = renderMarkdownBodyToHtml(strippedBody, mdDir);

    if (page.number === 1) {
      const headerMetadata = extractHeaderBodyMetadata(page.body);
      const coverUrl = resolveRenderableImageUrl(headerMetadata.cover, mdDir);
      const titleHtml = injectTitleContainer(html, headerMetadata.displayTags, coverUrl);
      return `<article class="tft-page" data-page="${page.number}">${titleHtml}</article>`;
    }

    return `<article class="tft-page" data-page="${page.number}">${html}</article>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>${buildPagedCss({ h1BackgroundImagePath })}</style>
</head>
<body>
${pageHtml}
</body>
</html>`;
}

function splitMarkdownFrontmatterRaw(markdown) {
  const source = String(markdown || '');
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    return {
      frontmatterRaw: '',
      body: source,
    };
  }

  return {
    frontmatterRaw: match[0],
    body: source.slice(match[0].length),
  };
}

function stripPageMarkers(markdown) {
  const { frontmatterRaw, body } = splitMarkdownFrontmatterRaw(markdown);
  const cleanBody = body.replace(PAGE_MARKER_LINE_RE, '');
  const leadingWhitespace = cleanBody.match(/^(?:[ \t]*\r?\n)+/)?.[0] || '';
  return {
    frontmatterRaw,
    leadingWhitespace,
    body: cleanBody.slice(leadingWhitespace.length),
  };
}

function isFenceStart(line) {
  return /^\s*(```|~~~)/.test(line);
}

function fenceToken(line) {
  const match = line.match(/^\s*(```|~~~)/);
  return match ? match[1] : null;
}

function isHeadingLine(line) {
  return /^#{1,6}\s+/.test(line.trim());
}

function isTopLevelListItem(line) {
  return /^(?:[-*+]|\d+[.)])\s+/.test(line.trimStart()) && (/^\s{0,3}\S/.test(line) || !/^\s/.test(line));
}

function isImageLine(line) {
  const trimmed = line.trim();
  return /^!\[[^\]]*]\([^)]+\)$/.test(trimmed) || /^!\[\[[\s\S]+]]$/.test(trimmed);
}

function isTableLine(line) {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.length > 2;
}

function collectTrailingBlankLines(lines, index, collected) {
  let nextIndex = index;
  while (nextIndex < lines.length && !lines[nextIndex].trim()) {
    collected.push(lines[nextIndex]);
    nextIndex++;
  }
  return nextIndex;
}

function splitMarkdownBlocks(markdownBody) {
  const lines = String(markdownBody || '').match(/.*(?:\r?\n|$)/g)
    ?.filter((line) => line.length > 0) || [];
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      const collected = [line];
      index = collectTrailingBlankLines(lines, index + 1, collected);
      blocks.push({ kind: 'blank', text: collected.join('') });
      continue;
    }

    if (isFenceStart(line)) {
      const token = fenceToken(line);
      const collected = [line];
      index++;
      while (index < lines.length) {
        collected.push(lines[index]);
        if (lines[index].trimStart().startsWith(token)) {
          index++;
          break;
        }
        index++;
      }
      index = collectTrailingBlankLines(lines, index, collected);
      blocks.push({ kind: 'code', text: collected.join('') });
      continue;
    }

    if (isHeadingLine(line)) {
      const collected = [line];
      index = collectTrailingBlankLines(lines, index + 1, collected);
      blocks.push({ kind: 'heading', text: collected.join('') });
      continue;
    }

    if (isImageLine(line)) {
      const collected = [line];
      index = collectTrailingBlankLines(lines, index + 1, collected);
      blocks.push({ kind: 'image', text: collected.join('') });
      continue;
    }

    if (isTableLine(line) && index + 1 < lines.length && /^[\s|:-]+$/.test(lines[index + 1].trim())) {
      const collected = [line];
      index++;
      while (index < lines.length && isTableLine(lines[index])) {
        collected.push(lines[index]);
        index++;
      }
      index = collectTrailingBlankLines(lines, index, collected);
      blocks.push({ kind: 'table', text: collected.join('') });
      continue;
    }

    if (isTopLevelListItem(line)) {
      const collected = [line];
      index++;
      while (index < lines.length) {
        if (isTopLevelListItem(lines[index]) || isHeadingLine(lines[index]) || isFenceStart(lines[index])) {
          break;
        }
        collected.push(lines[index]);
        const nextLine = lines[index + 1];
        index++;
        if (!collected.at(-1).trim() && nextLine && !/^\s+/.test(nextLine) && !isTopLevelListItem(nextLine)) {
          break;
        }
      }
      blocks.push({ kind: 'list-item', text: collected.join('') });
      continue;
    }

    const collected = [line];
    index++;
    while (index < lines.length) {
      if (
        !lines[index].trim()
        || isHeadingLine(lines[index])
        || isFenceStart(lines[index])
        || isTopLevelListItem(lines[index])
        || isImageLine(lines[index])
      ) {
        break;
      }
      collected.push(lines[index]);
      index++;
    }
    index = collectTrailingBlankLines(lines, index, collected);
    blocks.push({ kind: 'paragraph', text: collected.join('') });
  }

  return blocks.filter((block) => block.text.length > 0);
}

function joinBlocks(blocks, startIndex, endIndex) {
  return blocks.slice(startIndex, endIndex).map((block) => block.text).join('').trim();
}

function pageBreakPenalty({ blocks, endIndex, remaining, isLastPage }) {
  if (isLastPage) {
    return 0;
  }

  let penalty = remaining * remaining;
  const previousBlock = blocks[endIndex - 1];
  const nextBlock = blocks[endIndex];

  if (previousBlock?.kind === 'heading') {
    penalty += PLAN_HEADING_ORPHAN_PENALTY;
  }
  if (nextBlock?.kind === 'heading') {
    penalty = Math.max(0, penalty - PLAN_BREAK_BEFORE_HEADING_BONUS);
  }

  return penalty;
}

function renderPlanMarkdown({ frontmatterRaw, leadingWhitespace = '', blocks, breaks }) {
  const output = [];
  if (frontmatterRaw) {
    output.push(frontmatterRaw.replace(/\s*$/, '\n'));
  }
  output.push(leadingWhitespace);

  let startIndex = 0;
  breaks.forEach((endIndex, index) => {
    output.push(`<!-- tft-page: ${index + 1} -->\n\n`);
    output.push(blocks.slice(startIndex, endIndex).map((block) => block.text).join(''));
    if (!output.at(-1).endsWith('\n')) {
      output.push('\n');
    }
    startIndex = endIndex;
  });

  return output.join('').replace(/\s+$/, '\n');
}

async function waitForImages(page) {
  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete),
    undefined,
    { timeout: 25000 }
  ).catch(() => {});
  await sleep(100);
}

async function measurePlannedBody(page, mdDir, body, pageNumber, tempHtmlPath) {
  const parsed = {
    frontmatter: '',
    pages: [{ number: pageNumber, body }],
  };
  fs.writeFileSync(tempHtmlPath, buildPagedHtml(parsed, mdDir), 'utf8');
  await page.goto(imagePathToFileUrl(tempHtmlPath), { waitUntil: 'domcontentloaded' });
  await waitForImages(page);
  const [measurement] = await measurePages(page);
  return measurement?.height || 0;
}

async function collectFitCandidates({ page, mdDir, blocks, startIndex, pageNumber, targetHeight, tempHtmlPath }) {
  const candidates = [];

  for (let endIndex = startIndex + 1; endIndex <= blocks.length; endIndex++) {
    const body = joinBlocks(blocks, startIndex, endIndex);
    const height = await measurePlannedBody(page, mdDir, body, pageNumber, tempHtmlPath);
    if (height > targetHeight) {
      break;
    }
    candidates.push({
      endIndex,
      height,
      remaining: targetHeight - height,
    });
  }

  if (candidates.length === 0) {
    const body = joinBlocks(blocks, startIndex, startIndex + 1);
    const height = await measurePlannedBody(page, mdDir, body, pageNumber, tempHtmlPath);
    throw new Error(`单个内容块已超过页面高度，无法自动分页: block ${startIndex + 1}, height ${height}px`);
  }

  return candidates.slice(-PLAN_CANDIDATE_LIMIT);
}

async function planPageBreaks({ page, mdDir, blocks, targetHeight = PAGE_CONFIG.height, tempHtmlPath }) {
  const memo = new Map();
  const candidateMemo = new Map();

  async function candidatesFor(startIndex, pageNumber) {
    const key = `${startIndex}:${pageNumber === 1 ? 'first' : 'normal'}`;
    if (!candidateMemo.has(key)) {
      candidateMemo.set(key, collectFitCandidates({
        page,
        mdDir,
        blocks,
        startIndex,
        pageNumber,
        targetHeight,
        tempHtmlPath,
      }));
    }
    return candidateMemo.get(key);
  }

  async function solve(startIndex, pageNumber) {
    if (startIndex >= blocks.length) {
      return { cost: 0, breaks: [], pages: [] };
    }

    const key = `${startIndex}:${pageNumber}`;
    if (memo.has(key)) {
      return memo.get(key);
    }

    const candidates = await candidatesFor(startIndex, pageNumber);
    let best = null;

    for (const candidate of candidates) {
      const isLastPage = candidate.endIndex >= blocks.length;
      const currentPenalty = pageBreakPenalty({
        blocks,
        endIndex: candidate.endIndex,
        remaining: candidate.remaining,
        isLastPage,
      });
      const rest = isLastPage
        ? { cost: 0, breaks: [], pages: [] }
        : await solve(candidate.endIndex, pageNumber + 1);
      const totalCost = currentPenalty + rest.cost;
      if (!best || totalCost < best.cost) {
        best = {
          cost: totalCost,
          breaks: [candidate.endIndex, ...rest.breaks],
          pages: [
            {
              page: pageNumber,
              startIndex,
              endIndex: candidate.endIndex,
              height: Math.ceil(candidate.height),
              remaining: Math.ceil(candidate.remaining),
            },
            ...rest.pages,
          ],
        };
      }
    }

    memo.set(key, best);
    return best;
  }

  return solve(0, 1);
}

async function planPagedGuide(pagedMarkdownPath, options = {}) {
  const mdAbsPath = resolveMarkdownPath(pagedMarkdownPath);
  const mdDir = path.dirname(mdAbsPath);
  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const markdown = fs.readFileSync(mdAbsPath, 'utf8');
  const { frontmatterRaw, leadingWhitespace, body } = stripPageMarkers(markdown);
  const blocks = splitMarkdownBlocks(body);
  if (blocks.length === 0) {
    throw new Error('Markdown body is empty after removing old page markers.');
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutablePath(),
    args: ['--allow-file-access-from-files'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({
      width: PAGE_CONFIG.width,
      height: PAGE_CONFIG.height,
    });
    const candidateHtmlPath = path.join(outputDir, 'render-paged-plan-candidate.html');

    const plan = await planPageBreaks({
      page,
      mdDir,
      blocks,
      targetHeight: PAGE_CONFIG.height,
      tempHtmlPath: candidateHtmlPath,
    });
    const plannedMarkdown = renderPlanMarkdown({
      frontmatterRaw,
      leadingWhitespace,
      blocks,
      breaks: plan.breaks,
    });
    const parsed = parsePagedMarkdown(plannedMarkdown);
    const html = buildPagedHtml(parsed, mdDir);
    const htmlPath = path.join(outputDir, 'render-paged.html');
    fs.writeFileSync(htmlPath, html, 'utf8');
    await page.goto(imagePathToFileUrl(htmlPath), { waitUntil: 'domcontentloaded' });
    await waitForImages(page);
    const measurements = await measurePages(page);
    const report = validateMeasuredPages(parsed.pages, measurements, PAGE_CONFIG.height);
    const reportPath = path.join(outputDir, 'check-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    if (options.writePlan) {
      fs.writeFileSync(mdAbsPath, plannedMarkdown, 'utf8');
    }
    fs.rmSync(candidateHtmlPath, { force: true });

    return {
      ok: report.ok,
      planned: true,
      written: Boolean(options.writePlan),
      mdFile: mdAbsPath,
      outputDir,
      htmlPath,
      reportPath,
      report,
      pages: plan.pages,
      pageCount: parsed.pages.length,
    };
  } finally {
    await browser.close();
  }
}

async function measurePages(page) {
  return page.$$eval('.tft-page', (elements) => elements.map((element) => {
    const pageRect = element.getBoundingClientRect();
    const descendants = Array.from(element.querySelectorAll('*'));
    const contentBottom = descendants.reduce((maxBottom, child) => {
      const rect = child.getBoundingClientRect();
      const style = window.getComputedStyle(child);
      const marginBottom = Number.parseFloat(style.marginBottom) || 0;
      return Math.max(maxBottom, rect.bottom - pageRect.top + marginBottom);
    }, 0);

    return {
      page: Number(element.dataset.page),
      height: Math.ceil(contentBottom),
    };
  }));
}

async function screenshotPages(page, pages, outputDir, baseName) {
  const outputImages = [];

  for (const pageInfo of pages) {
    const selector = `.tft-page[data-page="${pageInfo.number}"]`;
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Cannot find rendered page ${pageInfo.number}.`);
    }

    const outputPath = path.join(
      outputDir,
      `${baseName}_${String(pageInfo.number).padStart(2, '0')}.${PAGE_CONFIG.imageFormat}`
    );
    await element.screenshot({
      path: outputPath,
      type: PAGE_CONFIG.imageFormat,
    });
    outputImages.push(outputPath);
  }

  return outputImages;
}

async function renderPagedGuide(pagedMarkdownPath, options = {}) {
  const mdAbsPath = resolveMarkdownPath(pagedMarkdownPath);
  const mdDir = path.dirname(mdAbsPath);
  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const baseName = options.baseName || 'TFT';
  if (options.cleanOutput && !options.checkOnly) {
    cleanOutputDir(outputDir);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const markdown = fs.readFileSync(mdAbsPath, 'utf8');
  const parsed = parsePagedMarkdown(markdown);
  const html = buildPagedHtml(parsed, mdDir);
  const htmlPath = path.join(outputDir, 'render-paged.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutablePath(),
    args: ['--allow-file-access-from-files'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({
      width: PAGE_CONFIG.width,
      height: PAGE_CONFIG.height,
    });

    await page.goto(imagePathToFileUrl(htmlPath), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout: 25000 }
    ).catch(() => {});
    await sleep(1000);

    const measurements = await measurePages(page);
    const report = validateMeasuredPages(parsed.pages, measurements, PAGE_CONFIG.height);
    const reportPath = path.join(outputDir, 'check-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    if (!report.ok || options.checkOnly) {
      return {
        ok: report.ok,
        checkOnly: true,
        mdFile: mdAbsPath,
        outputDir,
        htmlPath,
        reportPath,
        report,
        images: [],
      };
    }

    const images = await screenshotPages(page, parsed.pages, outputDir, baseName);
    const metadata = {
      mdFile: mdAbsPath,
      outputDir,
      htmlPath,
      reportPath,
      images,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(outputDir, 'metadata-paged.json'), JSON.stringify(metadata, null, 2), 'utf8');

    return {
      ok: true,
      checkOnly: false,
      mdFile: mdAbsPath,
      outputDir,
      htmlPath,
      reportPath,
      report,
      images,
    };
  } finally {
    await browser.close();
  }
}

function parseCliArgs(argv) {
  const options = {
    checkOnly: false,
    outputDir: DEFAULT_OUTPUT_DIR,
    plan: false,
    writePlan: false,
    cleanOutput: false,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--plan') {
      options.plan = true;
      continue;
    }
    if (arg === '--write') {
      options.writePlan = true;
      continue;
    }
    if (arg === '--clean-output') {
      options.cleanOutput = true;
      continue;
    }
    if (arg === '--check') {
      options.checkOnly = true;
      continue;
    }
    if (arg === '--output') {
      options.outputDir = argv[++index];
      continue;
    }
    if (arg === '--base-name') {
      options.baseName = argv[++index];
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  return {
    pagedMarkdownPath: positional[0],
    options,
  };
}

function printUsage() {
  console.log(`
Usage:
  node renderPaged.js <paged-markdown-file> [--plan] [--write] [--check] [--clean-output] [--output <dir>] [--base-name <name>]

Examples:
  node renderPaged.js "../../21 TFT/63 - 时间之神 艾克.md" --plan --write
  node renderPaged.js "../../21 TFT/63 - 时间之神 艾克.md" --check
  node renderPaged.js "../../21 TFT/63 - 时间之神 艾克.md" --output "../../21 TFT/output" --clean-output
  node "21 TFT/tools/tft-image/renderPaged.js" "21 TFT/63 - 时间之神 艾克.md"
`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  let cli;
  try {
    cli = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  const { pagedMarkdownPath, options } = cli;

  if (!pagedMarkdownPath) {
    printUsage();
    process.exit(1);
  }

  const run = options.plan
    ? planPagedGuide(pagedMarkdownPath, options)
    : renderPagedGuide(pagedMarkdownPath, options);

  run
    .then((result) => {
      console.log(formatCheckReport(result.report));
      console.log(`\nHTML:    ${result.htmlPath}`);
      console.log(`Report:  ${result.reportPath}`);

      if (!result.ok) {
        process.exitCode = 2;
      }

      if (result.planned) {
        console.log(`\nPlanned pages: ${result.pageCount}`);
        console.log(result.written
          ? `Page markers written: ${result.mdFile}`
          : 'Page markers not written because --write was not used.');
        return;
      }

      if (!result.ok) {
        return;
      }

      if (result.checkOnly) {
        console.log('\nCheck passed. No images exported because --check was used.');
        return;
      }

      console.log(`\nImages: ${result.images.length}`);
      for (const image of result.images) {
        console.log(`  ${image}`);
      }
    })
    .catch((error) => {
      console.error('\nRender failed:', error.message);
      process.exit(1);
    });
}

export {
  PAGE_CONFIG,
  buildPagedHtml,
  cleanOutputDir,
  measurePages,
  planPagedGuide,
  parseCliArgs,
  renderPlanMarkdown,
  renderPagedGuide,
  splitMarkdownBlocks,
  stripPageMarkers,
};
