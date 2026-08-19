export async function submitRequesterRevisionRequest(admin, task, actorId, payload = {}, deps = {}) {
  const feedback = String(payload?.requester_feedback || '').trim();
  if (!feedback) throw new Error('REQUESTER_REVISION_FEEDBACK_REQUIRED');
  const idempotencyKey = String(payload?.idempotency_key || '').trim();
  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (!task?.id) throw new Error('TASK_NOT_FOUND');

  const refreshTencent = Boolean(payload?.refresh_tencent_doc);
  if (refreshTencent) {
    if (typeof deps.refreshSources !== 'function') throw new Error('SOURCE_REFRESH_UNAVAILABLE');
    await deps.refreshSources(admin, task, actorId);
  }
  if (typeof deps.prepare !== 'function' || typeof deps.queue !== 'function') throw new Error('REVISION_WORKFLOW_DEPENDENCY_MISSING');

  const prepared = await deps.prepare(admin, task.id, actorId, {
    source_mode: refreshTencent ? 'combined' : 'system_text',
    system_content: feedback,
    use_tencent_doc: refreshTencent,
    requester_feedback: feedback,
    user_jwt: String(payload?.user_jwt || ''),
  }, deps.prepareDeps || {});

  if (String(prepared?.status || '') !== 'content_ready') return prepared;
  const revisionId = String(prepared?.revision?.id || '');
  if (!revisionId) throw new Error('CONTENT_REVISION_NOT_FOUND');
  const queued = await deps.queue(admin, task.id, revisionId, idempotencyKey);
  return { ...queued, prepared };
}
