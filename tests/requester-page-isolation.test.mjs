import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../task-detail-requester.html', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const requester = fs.readFileSync(new URL('../js/task-detail-requester.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../js/ai-requirement-client.js', import.meta.url), 'utf8');
const formal = fs.readFileSync(new URL('../js/requester-formal-deliveries.js', import.meta.url), 'utf8');
const compatibilityView = fs.readFileSync(new URL('../js/requester-demo-view-v12.js', import.meta.url), 'utf8');
const visualReference = fs.readFileSync(new URL('../js/visual-reference-ui.js', import.meta.url), 'utf8');
const requiredAssets = fs.readFileSync(new URL('../js/required-design-assets-ui.js', import.meta.url), 'utf8');

const orderedSections = [
  'request-detail-section',
  'required-assets-detail-panel',
  'visual-reference-detail-panel',
  'ai-requirement-panel',
  'version-history-block',
  'acceptance-panel',
];
orderedSections.reduce((previousIndex, id) => {
  const index = html.indexOf(`id="${id}"`);
  assert.ok(index > previousIndex, `${id} must appear in the formal requester order`);
  return index;
}, -1);
assert.match(html, /设计师历史交付版本库/);
assert.match(html, /image-preview-modal/);
assert.doesNotMatch(html, /框架方案 Demo|当前可验收设计版本|全阶段生成结果|Seedream|Google Drive|run id|AI生成日志|Prompt|第\s*\d+\s*次内容修改/i);
assert.doesNotMatch(html, /resource-summary-panel|task-lifecycle-log-panel/);

assert.doesNotMatch(requester, /history_json|globalHistoryArr|renderVersionHistory|uat_design_generations|requester-demo-review|all-generation-results|Seedream|Google Drive|run.?id|prompt|retry/i);
assert.match(requester, /\.select\('id,title,project,due_date,creator,assignee,full_desc,link,file_name,file_data,status'/);

const requesterBranch = config.slice(config.indexOf("if (page === 'task-detail-requester.html')"), config.indexOf("if (page === 'manager-workspace.html')"));
assert.match(requesterBranch, /requester-formal-deliveries/);
assert.doesNotMatch(requesterBranch, /requester-demo-view|seedream|drive-preview|all-generation|revision-loop/);

const communicationLoader = client.slice(client.indexOf('export async function loadAiCommunicationState'), client.indexOf('export async function saveVisualReferences'));
assert.match(communicationLoader, /task_ai_messages/);
assert.doesNotMatch(communicationLoader, /uat_design_generations|uat_clarifications|history_json/);
assert.match(formal, /design_versions/);
assert.match(formal, /design_version_assets/);
assert.match(formal, /asset\.asset_url/);
assert.doesNotMatch(formal, /drive_url|generation_url|run_id/);
assert.doesNotMatch(formal, /uat_design_generations|history_json|drive\.google|window\.open\(/i);
assert.match(compatibilityView, /requester-formal-deliveries/);
assert.doesNotMatch(compatibilityView, /uat_design_generations|Seedream|Google Drive|history_json/i);
const requesterVisual = visualReference.slice(visualReference.indexOf('async function installRequesterDetailPanel'), visualReference.indexOf('async function installAiWorkspaceCompanion'));
const requesterAssets = requiredAssets.slice(requiredAssets.indexOf('async function installRequesterDetailPanel'), requiredAssets.indexOf('async function installAiWorkspacePanel'));
assert.doesNotMatch(requesterVisual, /Seedream|千问|DeepSeek|Demo|prompt_version|Google Drive|run id|uat_requirement_analyses|visualAnalysisSummary/i);
assert.doesNotMatch(requesterAssets, /Seedream|千问|DeepSeek|Demo|Google Drive|run id/i);

console.log('requester page isolation tests passed');
