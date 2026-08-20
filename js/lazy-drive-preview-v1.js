export function createLazyPreviewQueue({ hydrate, rootMargin = '1000px 0px', concurrency = 2 } = {}) {
  if (typeof hydrate !== 'function') throw new Error('LAZY_PREVIEW_HYDRATE_REQUIRED');
  const payloads = new WeakMap();
  const queued = new Set();
  const queue = [];
  let active = 0;
  let disposed = false;

  const run = () => {
    if (disposed || document.hidden) return;
    while (active < concurrency && queue.length) {
      const node = queue.shift();
      queued.delete(node);
      if (!node?.isConnected || node.dataset.lazyPreviewState === 'ready' || node.dataset.lazyPreviewState === 'loading') continue;
      const payload = payloads.get(node);
      if (!payload) continue;
      active += 1;
      node.dataset.lazyPreviewState = 'loading';
      Promise.resolve(hydrate(node, payload))
        .then(() => { if (node?.isConnected) node.dataset.lazyPreviewState = 'ready'; })
        .catch((error) => {
          if (node?.isConnected) {
            node.dataset.lazyPreviewState = 'error';
            node.dispatchEvent(new CustomEvent('lazy-preview-error', { detail: error }));
          }
        })
        .finally(() => {
          active -= 1;
          queueMicrotask(run);
        });
    }
  };

  const enqueue = (node) => {
    if (!node?.isConnected || queued.has(node) || ['ready','loading'].includes(node.dataset.lazyPreviewState || '')) return;
    queued.add(node);
    queue.push(node);
    run();
  };

  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          enqueue(entry.target);
        }
      }, { root: null, rootMargin, threshold: 0.01 })
    : null;

  const observe = (node, payload) => {
    if (!node) return;
    payloads.set(node, payload);
    if (observer) observer.observe(node);
    else enqueue(node);
  };

  const retry = (node) => {
    if (!node) return;
    node.dataset.lazyPreviewState = '';
    if (observer) observer.observe(node);
    else enqueue(node);
  };

  const onVisibility = () => { if (!document.hidden) run(); };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    observe,
    retry,
    disconnect() {
      disposed = true;
      observer?.disconnect();
      queue.length = 0;
      queued.clear();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
