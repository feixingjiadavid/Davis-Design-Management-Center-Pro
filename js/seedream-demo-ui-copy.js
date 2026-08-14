function replacement(value) {
  const text = String(value || '');
  if (!text.includes('Cloudflare')) return text;
  // 历史审计说明必须保留真实模型名，避免“旧 Cloudflare Demo”被误写成“旧 Seedream Demo”。
  if (text.includes('旧 Cloudflare')) return text;
  return text.replaceAll('Cloudflare', 'Seedream 4.0');
}

function replaceCloudflareText(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) continue;
    const next = replacement(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

export function bootstrapSeedreamDemoCopy() {
  if (!/ai-designer-workspace\.html$/i.test(location.pathname)) return;
  replaceCloudflareText();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const node = mutation.target;
        const parent = node.parentElement;
        if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
          const next = replacement(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        }
        continue;
      }
      for (const added of mutation.addedNodes) {
        if (added.nodeType === Node.TEXT_NODE) {
          const next = replacement(added.nodeValue);
          if (next !== added.nodeValue) added.nodeValue = next;
        } else if (added.nodeType === Node.ELEMENT_NODE) {
          replaceCloudflareText(added);
        }
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

bootstrapSeedreamDemoCopy();
