import assert from 'node:assert/strict';
import { buildTemplateRevisionPrompt, TEMPLATE_REVISION_PROMPT_VERSION } from './template-revision-prompt.ts';

Deno.test('template prompt locks approved design and includes exact copy', () => {
  const prompt = buildTemplateRevisionPrompt({
    pageIndex: 2,
    pageTitle: '规则页',
    newCopy: ['金额改为8000元豆'],
    changeSummary: { changed: ['金额'] },
  });
  assert.equal(TEMPLATE_REVISION_PROMPT_VERSION, 'seedream-template-revision-v1');
  assert.match(prompt, /不可变视觉母版/);
  assert.match(prompt, /禁止重新设计/);
  assert.match(prompt, /金额改为8000元豆/);
  assert.doesNotMatch(prompt, /重新形成视觉概念/);
});
