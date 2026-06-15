#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, '..');
const guideRoot = resolve(skillDir, '..', '..');
const repoRoot = resolve(guideRoot, '..');
const toolDir = join(skillDir, 'scripts', 'tft-image');
const outputDir = join(guideRoot, 'output');
const renderScript = join(toolDir, 'renderPaged.js');
const nodeModulesDir = join(toolDir, 'node_modules');
const packageJsonPath = join(toolDir, 'package.json');

const args = process.argv.slice(2);
const checkEnvOnly = args.includes('--check-env');
const showDiff = args.includes('--show-diff');
const markdownArg = args.find((arg) => !arg.startsWith('--'));

function usage(exitCode = 0) {
  const command = 'node "21 TFT/skills/tft-page-planner/scripts/run-page-planner.mjs"';
  console.log(`Usage:
  ${command} --check-env
  ${command} "<path-to-guide.md>" [--show-diff]

The script uses the bundled renderer at:
  ${renderScript}`);
  process.exit(exitCode);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function run(command, commandArgs, cwd, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  });

  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function assertInside(childPath, rootPath, label) {
  const rel = relative(rootPath, childPath);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    return;
  }
  fail(`${label} must stay inside ${rootPath}: ${childPath}`);
}

function checkEnvironment() {
  run('node', ['--version'], toolDir);

  if (!existsSync(renderScript)) {
    fail(`renderPaged.js not found: ${renderScript}`);
  }

  if (!existsSync(packageJsonPath)) {
    fail(`package.json not found: ${packageJsonPath}`);
  }

  if (!existsSync(nodeModulesDir)) {
    fail(`node_modules not found: ${nodeModulesDir}. Run npm install in ${toolDir} only after user approval.`);
  }
}

function resolveMarkdown(input) {
  const markdownPath = resolve(process.cwd(), input);
  assertInside(markdownPath, guideRoot, 'Markdown path');

  if (!existsSync(markdownPath)) {
    fail(`Markdown file not found: ${markdownPath}`);
  }

  if (!statSync(markdownPath).isFile()) {
    fail(`Markdown path is not a file: ${markdownPath}`);
  }

  if (extname(markdownPath).toLowerCase() !== '.md') {
    fail(`Markdown path must end with .md: ${markdownPath}`);
  }

  return markdownPath;
}

if (args.includes('--help') || args.includes('-h')) {
  usage(0);
}

checkEnvironment();

if (checkEnvOnly) {
  console.log('Environment check: OK');
  process.exit(0);
}

if (!markdownArg) {
  usage(2);
}

const markdownPath = resolveMarkdown(markdownArg);
const relativeMarkdown = relative(repoRoot, markdownPath);

run('node', ['renderPaged.js', markdownPath, '--plan', '--write'], toolDir);
run('node', ['renderPaged.js', markdownPath, '--check'], toolDir);
run('node', ['renderPaged.js', markdownPath, '--output', outputDir, '--clean-output'], toolDir);
run('node', ['renderPaged.js', markdownPath, '--check'], toolDir);
run('git', ['diff', '--check', '--', relativeMarkdown], repoRoot);

const pngs = existsSync(outputDir)
  ? readdirSync(outputDir).filter((name) => name.toLowerCase().endsWith('.png')).sort()
  : [];

console.log(`Output directory: ${outputDir}`);
console.log(`PNG files (${pngs.length}):`);
for (const png of pngs) {
  console.log(`- ${png}`);
}

if (showDiff) {
  run('git', ['diff', '--', relativeMarkdown], repoRoot);
} else {
  console.log(`Review diff boundary manually: git diff -- "${relativeMarkdown}"`);
}
