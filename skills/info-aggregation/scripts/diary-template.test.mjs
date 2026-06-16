import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  readDiaryOrTemplate,
  renderDiaryTemplate,
} from './diary-template.mjs';

test('renderDiaryTemplate replaces date variables', () => {
  assert.equal(
    renderDiaryTemplate('# {{date}}\n{{year}}/{{month}}/{{day}}', '2026-05-14'),
    '# 2026-05-14\n2026/05/14',
  );
});

test('readDiaryOrTemplate falls back to empty content when template is missing', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diary-template-'));
  const diaryPath = path.join(diaryDir, '2026-05-14.md');

  assert.equal(await readDiaryOrTemplate(diaryPath, '2026-05-14'), '');
});

test('readDiaryOrTemplate creates seed content from default template path', async () => {
  const diaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diary-template-'));
  const templateDir = path.join(diaryDir, '模板');
  const diaryPath = path.join(diaryDir, '2026-05-14.md');

  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, '日记.md'), '# {{date}}\n\n## AI\n\n## 随手记', 'utf8');

  assert.equal(
    await readDiaryOrTemplate(diaryPath, '2026-05-14'),
    '# 2026-05-14\n\n## AI\n\n## 随手记',
  );
});
