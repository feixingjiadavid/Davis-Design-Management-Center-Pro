export function describeConfidence(value) {
  const raw = Number(value);
  const percent = Number.isFinite(raw)
    ? Math.max(0, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)))
    : 0;

  if (percent >= 85) {
    return {
      percent,
      label: '理解清楚',
      detail: `AI 对当前需求的理解把握较高（${percent}%）`,
      tone: 'emerald',
    };
  }
  if (percent >= 70) {
    return {
      percent,
      label: '基本理解',
      detail: `AI 已理解大部分需求，但仍有少量不确定（${percent}%）`,
      tone: 'amber',
    };
  }
  return {
    percent,
    label: '还不够确定',
    detail: `AI 对当前需求还有较多不确定（${percent}%）`,
    tone: 'rose',
  };
}

function toneClass(tone) {
  if (tone === 'emerald') return 'text-emerald-300';
  if (tone === 'amber') return 'text-amber-300';
  return 'text-rose-300';
}

function enhanceConfidenceLabels(root = document) {
  const labels = [...root.querySelectorAll('p')].filter(node => node.textContent?.trim() === '置信度');
  for (const label of labels) {
    const container = label.parentElement;
    if (!container || container.dataset.davisConfidenceExplained === '1') continue;
    const valueNode = label.nextElementSibling;
    const match = String(valueNode?.textContent || '').match(/(\d{1,3})\s*%/);
    if (!match) continue;

    const info = describeConfidence(Number(match[1]));
    container.dataset.davisConfidenceExplained = '1';
    container.innerHTML = `
      <p class="text-slate-500 mb-1">需求理解程度</p>
      <p class="${toneClass(info.tone)} font-bold">${info.label}</p>
      <p class="text-xs text-slate-400 mt-1">${info.detail}</p>
      <p class="text-[11px] text-slate-600 mt-1">百分比仅作辅助，不代表设计质量；是否继续由必要信息是否齐全、有没有待回答问题决定。</p>
    `;
  }
}

export function bootstrapAiConfidenceCopy() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__davisAiConfidenceCopyStarted) return;
  window.__davisAiConfidenceCopyStarted = true;

  enhanceConfidenceLabels(document);
  const observer = new MutationObserver(() => enhanceConfidenceLabels(document));
  observer.observe(document.body, { childList: true, subtree: true });
}
