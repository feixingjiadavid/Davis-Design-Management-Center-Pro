export function shouldPollAiRequirement({ analysisStatus = '' } = {}) {
  const status = String(analysisStatus || '').toLowerCase();
  if (!status) return false;
  if (status === 'confirmed' || status === 'stale') return false;
  return ['processing', 'analyzing', 'reanalyzing', 'clarification_required', 'understanding_ready'].includes(status);
}
