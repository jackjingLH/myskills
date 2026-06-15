import fs from 'node:fs/promises';
import path from 'node:path';

export function defaultDiaryTemplatePath(diaryDir) {
  return path.join(diaryDir, '模板', '日记.md');
}

export function renderDiaryTemplate(template, today) {
  const [year = '', month = '', day = ''] = String(today).split('-');
  return String(template)
    .replaceAll('{{date}}', today)
    .replaceAll('{{year}}', year)
    .replaceAll('{{month}}', month)
    .replaceAll('{{day}}', day);
}

export async function readDiaryOrTemplate(diaryPath, today, templatePath = defaultDiaryTemplatePath(path.dirname(diaryPath))) {
  try {
    return await fs.readFile(diaryPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    const template = await fs.readFile(templatePath, 'utf8');
    return renderDiaryTemplate(template, today);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return '';
  }
}
