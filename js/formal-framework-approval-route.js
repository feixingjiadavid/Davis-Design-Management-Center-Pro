function patchFormalApprovalLinks() {
  document.querySelectorAll('[onclick*="task-detail-locked.html"]').forEach((node) => {
    const current = node.getAttribute('onclick') || '';
    const next = current.replaceAll('task-detail-locked.html', 'task-detail-requester.html');
    if (next !== current) node.setAttribute('onclick', next);
  });
}

export function bootstrapFormalFrameworkApprovalRoute() {
  if ((location.pathname.split('/').pop() || '') !== 'manager-workspace.html') return;
  if (window.__formalFrameworkApprovalRouteStarted) return;
  window.__formalFrameworkApprovalRouteStarted = true;
  patchFormalApprovalLinks();
  const observer = new MutationObserver(() => patchFormalApprovalLinks());
  observer.observe(document.body, { childList: true, subtree: true });
}
