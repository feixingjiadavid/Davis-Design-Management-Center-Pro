function replaceCloudflareText(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) continue;
    if (!node.nodeValue?.includes('Cloudflare')) continue;
    node.nodeValue = node.nodeValue.replaceAll('Cloudflare', 'Seedream 4.0');
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
        if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) && node.nodeValue?.includes('Cloudflare')) {
          node.nodeValue = node.nodeValue.replaceAll('Cloudflare', 'Seedream 4.0');
        }
        continue;
      }
      for (const added of mutation.addedNodes) {
        if (added.nodeType === Node.TEXT_NODE && added.nodeValue?.includes('Cloudflare')) {
          added.nodeValue = added.nodeValue.replaceAll('Cloudflare', 'Seedream 4.0');
        } else if (added.nodeType === Node.ELEMENT_NODE) {
          replaceCloudflareText(added);
        }
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

bootstrapSeedreamDemoCopy();
