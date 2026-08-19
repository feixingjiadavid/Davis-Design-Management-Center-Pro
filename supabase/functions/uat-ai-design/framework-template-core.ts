export const CAPACITY_GROWTH_RATIO = 1.45;
export const CAPACITY_GROWTH_ABSOLUTE = 120;

const FORMAL_ACTIONS = new Set([
  'submit_framework', 'reject_framework', 'framework_adjustment_submitted', 'approve_framework',
  'content_revision_submitted', 'submit_draft', 'complete',
]);

const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const copyWeight = (copy: unknown[]) => (Array.isArray(copy) ? copy : []).map(normalize).join('').length;

export function latestFormalAction(history: any[]) {
  const rows = Array.isArray(history) ? history : [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (FORMAL_ACTIONS.has(String(rows[index]?.action || ''))) return rows[index];
  }
  return null;
}

export function latestSubmittedFramework(history: any[]) {
  const rows = Array.isArray(history) ? history : [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.action === 'submit_framework') return rows[index];
  }
  return null;
}

export function assertFrameworkCanBeRejected(task: any, history: any[]) {
  if (String(task?.status || '') !== 'pending_approval') throw new Error('FRAMEWORK_NOT_PENDING_APPROVAL');
  if (!latestSubmittedFramework(history)) throw new Error('SUBMITTED_FRAMEWORK_REQUIRED');
}

export function assertFrameworkCanBeApproved(task: any, history: any[]) {
  if (String(task?.status || '') !== 'pending_approval') throw new Error('FRAMEWORK_NOT_PENDING_APPROVAL');
  if (!latestSubmittedFramework(history)) throw new Error('SUBMITTED_FRAMEWORK_REQUIRED');
}

export function validateTemplatePages(pages: any[]) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('TEMPLATE_PAGES_REQUIRED');
  const sorted = [...pages].sort((a, b) => Number(a.page_index) - Number(b.page_index));
  sorted.forEach((page, offset) => {
    if (Number(page.page_index) !== offset + 1) throw new Error('TEMPLATE_PAGE_ORDER_INVALID');
    if (!normalize(page.page_title)) throw new Error('TEMPLATE_PAGE_ROLE_REQUIRED');
    if (!normalize(page.drive_file_id)) throw new Error('TEMPLATE_DRIVE_FILE_REQUIRED');
  });
  return sorted;
}

export function exceedsTemplateCapacity(templateCopy: unknown[], nextCopy: unknown[]) {
  const before = Math.max(1, copyWeight(templateCopy));
  const after = copyWeight(nextCopy);
  const limit = Math.max(Math.ceil(before * CAPACITY_GROWTH_RATIO), before + CAPACITY_GROWTH_ABSOLUTE);
  return after > limit;
}

export function diffFixedTemplatePages(templatePages: any[], nextPages: any[]) {
  const template = Array.isArray(templatePages) ? [...templatePages].sort((a, b) => Number(a.page_index) - Number(b.page_index)) : [];
  const next = Array.isArray(nextPages) ? [...nextPages].sort((a, b) => Number(a.index) - Number(b.index)) : [];
  if (template.length !== next.length) return { affectedPages: [], capacityConflict: true, reason: 'PAGE_COUNT_CHANGED' };
  const affectedPages: number[] = [];
  for (let offset = 0; offset < template.length; offset += 1) {
    const current = template[offset];
    const incoming = next[offset];
    const pageIndex = Number(current.page_index || offset + 1);
    if (pageIndex !== Number(incoming.index || offset + 1)) return { affectedPages: [], capacityConflict: true, reason: 'PAGE_ORDER_CHANGED' };
    if (normalize(current.page_title) !== normalize(incoming.title)) return { affectedPages: [], capacityConflict: true, reason: 'PAGE_ROLE_CHANGED' };
    if (exceedsTemplateCapacity(current.exact_copy || [], incoming.copy || [])) return { affectedPages: [], capacityConflict: true, reason: 'PAGE_CAPACITY_EXCEEDED' };
    const before = (Array.isArray(current.exact_copy) ? current.exact_copy : []).map(normalize);
    const after = (Array.isArray(incoming.copy) ? incoming.copy : []).map(normalize);
    if (JSON.stringify(before) !== JSON.stringify(after)) affectedPages.push(pageIndex);
  }
  return { affectedPages, capacityConflict: false, reason: null };
}

export function buildRevisionManifest(templatePages: any[], previousManifest: any[], generatedPages: any[]) {
  const previous = new Map((Array.isArray(previousManifest) ? previousManifest : []).map((page: any) => [Number(page.page_index), page]));
  const generated = new Map((Array.isArray(generatedPages) ? generatedPages : []).map((row: any) => [Number(row.page_index), row]));
  return [...templatePages].sort((a: any, b: any) => Number(a.page_index) - Number(b.page_index)).map((template: any) => {
    const pageIndex = Number(template.page_index);
    const row: any = generated.get(pageIndex);
    if (row) {
      const output = row.output && typeof row.output === 'object' ? row.output : {};
      return {
        page_index: pageIndex,
        source: 'revision',
        generation_id: row.id,
        drive_file_id: String(output.drive_file_id || ''),
        drive_url: String(output.drive_url || output.image_url || ''),
      };
    }
    const old: any = previous.get(pageIndex);
    if (old) return { ...old, page_index: pageIndex };
    return {
      page_index: pageIndex,
      source: 'template',
      generation_id: template.generation_id || null,
      drive_file_id: String(template.drive_file_id || ''),
      drive_url: String(template.drive_url || ''),
    };
  });
}
