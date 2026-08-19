function safe(value) {
  return String(value || 'task').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100) || 'task';
}

export function buildArchiveTaskId({ taskId, generationMode, frameworkAdjustmentId = '', revisionNo = 0 } = {}) {
  const base = safe(taskId);
  const mode = String(generationMode || 'initial_framework');
  if (mode === 'framework_revision') {
    const suffix = safe(String(frameworkAdjustmentId || '').slice(0, 8) || 'revision');
    return `${base}__framework-${suffix}`;
  }
  if (mode === 'content_revision') {
    const numericRevision = Number(revisionNo || 0);
    const suffix = Number.isFinite(numericRevision) && numericRevision > 0 ? `r${numericRevision}` : 'revision';
    return `${base}__content-${suffix}`;
  }
  return base;
}
