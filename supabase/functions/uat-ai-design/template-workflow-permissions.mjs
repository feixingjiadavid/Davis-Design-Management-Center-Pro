const LEADER = 'uat.leader@webank.com';
const REQUESTER = 'uat.requester@webank.com';
const AI_DESIGNER = 'davis.design.ai@webank.com';

const LEADER_ACTIONS = new Set(['approve_framework', 'reject_framework']);
const REQUESTER_ACTIONS = new Set([
  'submit_content_revision_request',
  'answer_content_revision_clarification',
  'accept_current_revision',
]);
const AI_DESIGNER_ACTIONS = new Set([
  'generate_framework_revision',
  'check_content_update',
  'prepare_content_revision',
  'generate_content_revision',
]);

export function roleForTemplateWorkflowAction(action = '', email = '') {
  const normalizedAction = String(action || '');
  const normalizedEmail = String(email || '').toLowerCase();
  if (LEADER_ACTIONS.has(normalizedAction)) return normalizedEmail === LEADER ? 'leader' : 'forbidden';
  if (REQUESTER_ACTIONS.has(normalizedAction)) return normalizedEmail === REQUESTER ? 'requester' : 'forbidden';
  if (AI_DESIGNER_ACTIONS.has(normalizedAction)) return normalizedEmail === AI_DESIGNER ? 'ai_designer' : 'forbidden';
  return 'unknown';
}

export function assertTemplateWorkflowActor(action = '', email = '') {
  const role = roleForTemplateWorkflowAction(action, email);
  if (role === 'leader' || role === 'requester' || role === 'ai_designer') return role;
  if (role === 'unknown') throw new Error('TEMPLATE_WORKFLOW_ACTION_UNKNOWN');
  if (LEADER_ACTIONS.has(String(action || ''))) throw new Error('LEADER_ACTION_FORBIDDEN');
  if (REQUESTER_ACTIONS.has(String(action || ''))) throw new Error('REQUESTER_ACTION_FORBIDDEN');
  throw new Error('AI_DESIGNER_ACTION_FORBIDDEN');
}
