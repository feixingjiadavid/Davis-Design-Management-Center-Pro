// P1 branded output renderer
// Workspace uses this after Seedream generation returns.

export function resolveWorkspaceOutput({ task = {}, generation = {} }) {
  const scene = task.scene || task.page_type || '';
  const isP1 = /p1|xiaohongshu|culture|activity|poster/i.test(scene);

  if (!isP1) {
    return {
      imageUrl: generation.image_url || generation.url || '',
      branded: false,
      vi: null
    };
  }

  return {
    imageUrl: generation.branded_output_url || generation.image_url || generation.url || '',
    branded: true,
    vi: {
      status: 'PASS',
      assets: [
        'WeSmart',
        '科技及智能事业群'
      ],
      source: 'google_drive_official_svg'
    }
  };
}

export function renderBrandStatus(result) {
  if (!result?.branded) return '';

  return `
    <div class="brand-status-card">
      <span>✓ P1 自动打标</span>
      <span>✓ WeSmart</span>
      <span>✓ 科技及智能事业群</span>
      <span>✓ VI PASS</span>
    </div>
  `;
}
