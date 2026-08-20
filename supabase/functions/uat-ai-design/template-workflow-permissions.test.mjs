import assert from 'node:assert/strict';
import { assertTemplateWorkflowActor, roleForTemplateWorkflowAction } from './template-workflow-permissions.mjs';

assert.equal(roleForTemplateWorkflowAction('submit_content_revision_request', 'uat.requester@webank.com'), 'requester');
assert.equal(roleForTemplateWorkflowAction('accept_current_revision', 'uat.requester@webank.com'), 'requester');
assert.equal(roleForTemplateWorkflowAction('prepare_content_revision', 'davis.design.ai@webank.com'), 'ai_designer');
assert.equal(roleForTemplateWorkflowAction('generate_content_revision', 'davis.design.ai@webank.com'), 'ai_designer');
assert.equal(roleForTemplateWorkflowAction('generate_framework_revision', 'davis.design.ai@webank.com'), 'ai_designer');
assert.equal(roleForTemplateWorkflowAction('generate_content_revision', 'uat.requester@webank.com'), 'forbidden');
assert.equal(roleForTemplateWorkflowAction('generate_framework_revision', 'uat.requester@webank.com'), 'forbidden');
assert.throws(() => assertTemplateWorkflowActor('generate_content_revision', 'uat.requester@webank.com'), /AI_DESIGNER_ACTION_FORBIDDEN/);
assert.throws(() => assertTemplateWorkflowActor('approve_framework', 'uat.requester@webank.com'), /LEADER_ACTION_FORBIDDEN/);
console.log('template workflow permissions: 9/9 passed');
