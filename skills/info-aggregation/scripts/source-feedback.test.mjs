import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  collectFeedbackFromMarkdown,
  renderFeedbackSummary,
  summarizeFeedback,
} from './source-feedback.mjs';

test('collectFeedbackFromMarkdown reads source comments and todo state', () => {
  const rows = collectFeedbackFromMarkdown(`## AI

#### X
- [x] [Elon Musk](https://x.com/elonmusk)
  %% source: AI|X|Elon Musk|https://x.com/elonmusk %%
  > [!quote]- 中文翻译
  > 机器人会改变一切。

- [ ] [sama](https://x.com/sama)
  %% source: AI|X|Elon Musk|https://x.com/elonmusk %%
`, '2026-05-20');

  assert.equal(rows.length, 2);
  assert.equal(rows[0].source.name, 'Elon Musk');
  assert.equal(rows[0].done, true);
  assert.equal(rows[1].done, false);
});

test('summarizeFeedback aggregates activity to source level', () => {
  const summary = summarizeFeedback([
    {
      date: '2026-05-20',
      source: { module: 'AI', platform: 'X', name: 'Elon Musk', url: 'https://x.com/elonmusk' },
      done: true,
    },
    {
      date: '2026-05-20',
      source: { module: 'AI', platform: 'X', name: 'Elon Musk', url: 'https://x.com/elonmusk' },
      done: false,
    },
    {
      date: '2026-05-21',
      source: { module: 'AI', platform: 'X', name: 'Elon Musk', url: 'https://x.com/elonmusk' },
      done: true,
    },
  ]);

  assert.equal(summary.length, 1);
  assert.equal(summary[0].total, 3);
  assert.equal(summary[0].processed, 2);
  assert.equal(summary[0].unprocessed, 1);
  assert.equal(summary[0].lastSeen, '2026-05-21');
  assert.match(renderFeedbackSummary(summary), /最近命中/);
});
