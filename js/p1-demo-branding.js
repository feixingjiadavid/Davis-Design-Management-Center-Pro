// P1 demo revision branding hook
// Called after every demo/final revision image is generated.

export function shouldApplyP1Branding(task = {}) {
  const text = JSON.stringify(task).toLowerCase();
  return (
    text.includes('p1') ||
    text.includes('小红书') ||
    text.includes('文化活动') ||
    text.includes('文化')
  );
}

export function buildDemoRevisionBrandPayload({ task, generation }) {
  if (!shouldApplyP1Branding(task)) {
    return { enabled: false, generation };
  }

  return {
    enabled: true,
    stage: 'demo_revision_branding',
    input: generation?.image_url || generation?.url || null,
    requiredAssets: [
      'wesmart',
      'tech_group'
    ],
    rule: 'p1_xiaohongshu_poster',
    output: {
      type: 'branded_output',
      replaceDisplayImage: true
    }
  };
}
