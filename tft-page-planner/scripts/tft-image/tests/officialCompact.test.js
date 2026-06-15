import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_CONFIG,
  PAGE_STYLE,
  buildPagedCss,
} from '../styles/officialCompact.js';

function styleBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*{(?<style>[\\s\\S]*?)\\n  }`))?.groups?.style || '';
}

test('style module preserves classic page config and cover css', () => {
  const css = buildPagedCss({ h1BackgroundImagePath: 'file:///D:/OB/JLH/bg.png' });

  assert.equal(PAGE_CONFIG.width, 900);
  assert.equal(PAGE_CONFIG.height, 1200);
  assert.equal(PAGE_CONFIG.imageFormat, 'png');
  assert.equal(PAGE_STYLE.fontSize, '30px');
  assert.equal(PAGE_STYLE.lineHeight, '1.9');

  assert.match(css, /url\('file:\/\/\/D:\/OB\/JLH\/bg\.png'\)/);

  const h1Style = styleBlock(css, 'h1');
  assert.match(h1Style, /font-size:\s*106px;/);
  assert.match(h1Style, /line-height:\s*1\.14;/);

  const coverStyle = styleBlock(css, '.cover-image');
  assert.match(coverStyle, /max-width:\s*100%;/);
  assert.match(coverStyle, /margin:\s*28px 0 0 0;/);
});
