const SECTION_HEADING = '## TFT 信息聚合';
const FAILURE_HEADING = '### 失败';

export function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function displayText(value) {
  const text = String(value ?? '').trim();
  const linkMatch = text.match(/^\[([^\]]+)\]\([^)]+\)$/);
  return linkMatch ? linkMatch[1] : text;
}

function cleanSummary(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderSummaryCallout(summary) {
  const lines = cleanSummary(summary);
  if (lines.length === 0) return [];
  return [
    '',
    '> [!summary]- 中文总结',
    ...lines.map((line) => `> ${line}`),
  ];
}

function renderSourceMeta(item) {
  const parts = [
    item.module || 'TFT',
    item.platform,
    displayText(item.author),
    item.sourceUrl,
  ].map((part) => String(part ?? '').trim()).filter(Boolean);

  if (parts.length === 0) return [];
  return [`  %% source: ${parts.join('|')} %%`];
}

function isItemDone(item) {
  return Boolean(item.done);
}

export function buildRows(items) {
  const groups = new Map();

  for (const item of items) {
    const platform = escapeCell(item.platform || '未分类');
    if (!groups.has(platform)) groups.set(platform, []);
    groups.get(platform).push([
      `- [${isItemDone(item) ? 'x' : ' '}] ${escapeCell(item.title)}`,
      ...renderSourceMeta(item),
      ...renderSummaryCallout(item.summary),
    ]);
  }

  return [...groups.entries()].flatMap(([platform, rows], index) => {
    const renderedRows = rows.flatMap((row, rowIndex) => [
      ...(rowIndex > 0 && (row.length > 1 || rows[rowIndex - 1].length > 1) ? [''] : []),
      ...row,
    ]);
    return [
      ...(index === 0 ? [] : ['']),
      `#### ${platform}`,
      ...renderedRows,
    ];
  });
}

export function buildFailureRows(items) {
  return items.map((item) => `- ${escapeCell(item.platform)}｜${escapeCell(item.author)}｜${escapeCell(item.description)}`);
}

function replacementKey(item) {
  return `${item.platform}\n${displayText(item.author)}`;
}

function mergeKeys(...itemGroups) {
  const keys = new Set();
  for (const group of itemGroups) {
    for (const item of group) {
      keys.add(replacementKey(item));
    }
  }
  return keys;
}

function isClearedByItem(platform, author, clearItem) {
  if (platform !== clearItem.platform) return false;
  return clearItem.author == null || displayText(author) === displayText(clearItem.author);
}

function shouldDropExistingRow(platform, author, replacementKeys, clearItems) {
  const key = `${platform}\n${displayText(author)}`;
  return replacementKeys.has(key)
    || clearItems.some((item) => isClearedByItem(platform, author, item));
}

export function renderTableSection(items, today) {
  const contentItems = items.filter((item) => item.kind !== 'failure');
  const failureItems = items.filter((item) => item.kind === 'failure');
  const todoLines = contentItems.length > 0
    ? buildRows(contentItems)
    : ['暂无待处理内容。'];

  const lines = [
    SECTION_HEADING,
    '',
    ...todoLines,
  ];

  if (failureItems.length > 0) {
    lines.push(
      '',
      FAILURE_HEADING,
      '',
      ...buildFailureRows(failureItems),
    );
  }

  return lines.join('\n').trimEnd();
}

function extractSection(markdown) {
  const start = markdown.indexOf(SECTION_HEADING);
  if (start === -1) {
    return { start: -1, end: -1, content: '' };
  }

  const nextHeadingMatch = markdown.slice(start + SECTION_HEADING.length).match(/\n## /);
  const end = nextHeadingMatch
    ? start + SECTION_HEADING.length + nextHeadingMatch.index
    : markdown.length;

  return { start, end, content: markdown.slice(start, end) };
}

function isTaskRow(line) {
  return line.startsWith('- [ ] ') || line.startsWith('- [x] ');
}

function isListRow(line) {
  return line.startsWith('- ');
}

function splitTaskRow(line) {
  return getTaskText(line).split('｜').map((cell) => cell.trim());
}

function getTaskText(line) {
  return line.replace(/^- (?:\[[ xX]\]\s+)?/, '').trim();
}

function isSourceMetaRow(line) {
  return /^\s*%%\s*source:/.test(line);
}

function isCheckedTask(line) {
  return /^- \[[xX]\]\s+/.test(line);
}

function isIndentedCheckboxRow(line) {
  return /^\s+- \[[ xX]\]\s+/.test(line) && !line.startsWith('- ');
}

function collectTaskDetails(lines, startIndex) {
  let index = startIndex;
  const summaryLines = [];

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || isSourceMetaRow(line) || isIndentedCheckboxRow(line)) {
      index += 1;
      continue;
    }
    break;
  }

  if (!lines[index]?.startsWith('> [!summary]')) {
    return { summary: '', nextIndex: index };
  }

  index += 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith('> ')) {
      summaryLines.push(line.replace(/^>\s?/, ''));
      index += 1;
      continue;
    }
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    break;
  }

  return {
    summary: summaryLines.join('\n').trim(),
    nextIndex: index,
  };
}

export function getExistingRows(markdown, replacementItems, clearItems = []) {
  const { content } = extractSection(markdown);
  if (!content) return [];

  const replacementKeys = mergeKeys(replacementItems, clearItems);
  const rows = [];
  let currentPlatform = '';
  let inFailureSection = false;
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
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

    if (!isListRow(line)) continue;

    if (!inFailureSection) {
      const taskText = getTaskText(line);

      if (!taskText.includes('｜')) {
        if (!currentPlatform) continue;

        if (!shouldDropExistingRow(currentPlatform, '', replacementKeys, clearItems)) {
          const { summary, nextIndex } = collectTaskDetails(lines, index + 1);
          rows.push({
            kind: 'content',
            platform: currentPlatform,
            author: '',
            title: taskText,
            description: '',
            done: isCheckedTask(line),
            summary,
          });
          index = Math.max(index, nextIndex - 1);
        }
        continue;
      }

      const cells = splitTaskRow(line);
      if (cells.length < 4 && currentPlatform) {
        if (!shouldDropExistingRow(currentPlatform, '', replacementKeys, clearItems)) {
          const { summary, nextIndex } = collectTaskDetails(lines, index + 1);
          rows.push({
            kind: 'content',
            platform: currentPlatform,
            author: '',
            title: taskText,
            description: '',
            done: isCheckedTask(line),
            summary,
          });
          index = Math.max(index, nextIndex - 1);
        }
        continue;
      }
      if (cells.length < 4) continue;
      if (!shouldDropExistingRow(cells[0], cells[1], replacementKeys, clearItems)) {
        const { summary, nextIndex } = collectTaskDetails(lines, index + 1);
        rows.push({
          kind: 'content',
          platform: cells[0],
          author: cells[1],
          title: cells[2],
          description: cells.slice(3).join('｜'),
          done: isCheckedTask(line),
          summary,
        });
        index = Math.max(index, nextIndex - 1);
      }
    } else {
      const cells = line.replace(/^- /, '').split('｜').map((cell) => cell.trim());
      if (cells.length < 3) continue;

      if (!shouldDropExistingRow(cells[0], cells[1], replacementKeys, clearItems)) {
        rows.push({
          kind: 'failure',
          platform: cells[0],
          author: cells[1],
          description: cells.slice(2).join('｜'),
        });
      }
    }
  }

  return rows;
}

export function upsertTableSection(markdown, replacementItems, today, clearItems = []) {
  const existingRows = getExistingRows(markdown, replacementItems, clearItems);
  const section = renderTableSection([...existingRows, ...replacementItems], today);
  const { start, end } = extractSection(markdown);

  if (start === -1) {
    return markdown.trimEnd() ? `${markdown.trimEnd()}\n\n${section}` : section;
  }

  return `${markdown.slice(0, start).trimEnd()}\n\n${section}\n\n${markdown.slice(end).trimStart()}`.trimStart();
}

export { SECTION_HEADING };
