const TEMPLATE_EDITABLE_FIELDS = Object.freeze(['title', 'speaker', 'time', 'location', 'qr_code', 'content']);
const TEMPLATE_LOCKED_FIELDS = Object.freeze(['layout', 'logo_position', 'brand_area', 'fixed_components']);

function text(value) {
  return String(value || '').trim();
}

function normalized(value) {
  return text(value).toLocaleLowerCase().replace(/[\s·・_\-/]+/g, '');
}

function taskSearchText(task = {}) {
  const brief = task.brief && typeof task.brief === 'object' ? task.brief : {};
  return normalized([
    task.activity_type,
    task.event_type,
    task.template_type,
    task.title,
    task.name,
    brief.activity_type,
    brief.goal,
  ].filter(Boolean).join(' '));
}

function matchesActivity(rule, task) {
  const haystack = taskSearchText(task);
  return (Array.isArray(rule?.activity_types) ? rule.activity_types : [])
    .some((activity) => {
      const needle = normalized(activity);
      return needle && haystack.includes(needle);
    });
}

function templateSearchText(template = {}) {
  return normalized([template.name, template.template_family, template.template_type].filter(Boolean).join(' '));
}

function isEligibleTemplate(template, rule) {
  const rules = template?.rules && typeof template.rules === 'object' ? template.rules : {};
  return text(template?.status) === 'approved'
    && text(template?.template_mode) === 'replace_content'
    && text(template?.brand_rule_id) === text(rule?.id)
    && Boolean(text(template?.template_asset_url))
    && rules.generation_enabled === true
    && Array.isArray(rules.editable_area)
    && Array.isArray(rules.locked_area)
    && Array.isArray(rules.variable_slots);
}

function selectTemplate(templates, task, rule) {
  const haystack = taskSearchText(task);
  return (Array.isArray(templates) ? templates : [])
    .filter((template) => isEligibleTemplate(template, rule))
    .map((template) => {
      const identity = templateSearchText(template);
      const score = identity && haystack.includes(identity) ? 2
        : [template.name, template.template_family, template.template_type]
          .map(normalized)
          .filter(Boolean)
          .some((token) => haystack.includes(token)) ? 1 : 0;
      return { template, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || text(left.template.id).localeCompare(text(right.template.id)))
    .at(0)?.template || null;
}

function isLogoAsset(asset = {}) {
  const role = normalized(asset.asset_role || asset.asset_type);
  const name = normalized(asset.file_name || asset.name || asset.storage_path);
  return role.includes('logo') || role.includes('标志') || role.includes('标识')
    || name.includes('logo') || name.includes('wesmart') || name.includes('科技及智能事业群');
}

export function filterCreativeAssets(assets = []) {
  return (Array.isArray(assets) ? assets : []).filter((asset) => !isLogoAsset(asset));
}

export function resolveGenerationPlan({ task = {}, pageNo = 1, approvedTemplates = [], brandRules = [], brandAssets = [] } = {}) {
  const rules = Array.isArray(brandRules) ? brandRules : [];
  const matchedRule = rules.find((rule) => rule.code !== 'generic_no_brand' && matchesActivity(rule, task));
  const genericRule = rules.find((rule) => rule.code === 'generic_no_brand');
  const brandRule = matchedRule || genericRule;
  if (!brandRule) throw new Error('BRAND_RULE_NOT_FOUND');

  const pageRules = brandRule.page_rules && typeof brandRule.page_rules === 'object' ? brandRule.page_rules : {};
  const numericPage = Number(pageNo);
  const pageRule = pageRules[String(numericPage)]
    || (numericPage === 1 ? pageRules.P1 : pageRules['P2-PN'])
    || pageRules.default;
  if (!pageRule?.canvas || !pageRule?.creative_area) throw new Error('BRAND_PAGE_RULE_INVALID');

  const requiredTypes = pageRule.apply_brand === true
    ? (Array.isArray(brandRule.required_asset_types) ? brandRule.required_asset_types : [])
    : [];
  const activeAssets = (Array.isArray(brandAssets) ? brandAssets : [])
    .filter((asset) => asset.status === 'active' && asset.brand_id === brandRule.brand_id);
  const requiredBrandAssets = requiredTypes
    .map((assetType) => activeAssets.find((asset) => asset.asset_type === assetType))
    .filter(Boolean);
  const missingAssetTypes = requiredTypes.filter((assetType) => !requiredBrandAssets.some((asset) => asset.asset_type === assetType));
  const template = selectTemplate(approvedTemplates, task, brandRule);
  const variableSlots = new Set(Array.isArray(template?.rules?.variable_slots) ? template.rules.variable_slots : []);
  const editableFields = template
    ? TEMPLATE_EDITABLE_FIELDS.filter((field) => variableSlots.has(field))
    : [];

  const blockReason = brandRule.status !== 'active'
    ? 'BRAND_RULE_INACTIVE'
    : missingAssetTypes.length
      ? 'BRAND_ASSETS_MISSING'
      : null;

  return {
    mode: template ? 'replace_content' : 'creative_generate',
    brandRule,
    pageRule,
    canvas: { ...pageRule.canvas },
    creativeArea: { ...pageRule.creative_area },
    safeArea: { ...(pageRule.brand_safe_area || {}) },
    requiredBrandAssets,
    missingAssetTypes,
    forbiddenAssetTypes: [...(Array.isArray(pageRule.forbidden_asset_types) ? pageRule.forbidden_asset_types : [])],
    template,
    editableFields,
    lockedFields: template ? [...TEMPLATE_LOCKED_FIELDS] : [],
    publishable: blockReason === null,
    blockReason,
  };
}

export const TEMPLATE_REPLACE_FIELDS = TEMPLATE_EDITABLE_FIELDS;
export const TEMPLATE_LOCKS = TEMPLATE_LOCKED_FIELDS;

