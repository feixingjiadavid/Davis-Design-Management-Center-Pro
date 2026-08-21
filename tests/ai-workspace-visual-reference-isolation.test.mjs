import assert from 'node:assert/strict';
import test from 'node:test';
import * as visualReferenceUi from '../js/visual-reference-ui.js';

test('AI visual reference panel never repeats generated design images', () => {
  assert.equal(typeof visualReferenceUi.renderAiWorkspaceVisualContextHtml, 'function');
  const html = visualReferenceUi.renderAiWorkspaceVisualContextHtml({
    refs:[{ data_url:'data:image/jpeg;base64,REFERENCE', is_primary:true }],
    currentAnalysis:{ brief:{ visual_reference_analysis:{ summary:'已理解参考图' } } },
    stateCopy:'视觉参考分析完成',
  });

  assert.match(html, /data:image\/jpeg;base64,REFERENCE/);
  assert.doesNotMatch(html, /Demo|doubao-seedream|uat_design_generations|生成中…/i);
});
