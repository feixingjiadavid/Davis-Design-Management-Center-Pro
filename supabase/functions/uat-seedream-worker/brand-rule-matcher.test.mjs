import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCreativeAssets, resolveGenerationPlan } from './brand-rule-matcher.mjs';

const genericRule = {
  id: 'rule-generic',
  code: 'generic_no_brand',
  brand_id: 'system_default',
  activity_types: [],
  required_asset_types: [],
  status: 'active',
  page_rules: {
    default: {
      apply_brand: false,
      canvas: { x: 0, y: 0, width: 1242, height: 1660 },
      creative_area: { x: 0, y: 0, width: 1242, height: 1660 },
      forbidden_asset_types: [],
    },
  },
};

const cultureRule = {
  id: 'rule-culture',
  code: 'culture_activity_default',
  brand_id: 'culture_activity',
  activity_types: ['OpenTalk', 'TIG周年活动', 'AICoding分享', '培训活动', '内部文化活动'],
  required_asset_types: ['wesmart_logo', 'tig_org_logo'],
  status: 'active',
  page_rules: {
    1: {
      apply_brand: true,
      canvas: { x: 0, y: 0, width: 1242, height: 1660 },
      creative_area: { x: 0, y: 220, width: 1242, height: 1260 },
      brand_safe_area: { top_left_reserved: true, bottom_reserved: true },
      placements: {
        wesmart_logo: { x: 72, y: 64, max_width: 300, max_height: 84, preserve_aspect_ratio: true },
        tig_org_logo: { x: 72, y: 1516, max_width: 1098, max_height: 80, preserve_aspect_ratio: true },
      },
    },
    default: {
      apply_brand: false,
      canvas: { x: 0, y: 0, width: 1242, height: 1660 },
      creative_area: { x: 0, y: 0, width: 1242, height: 1660 },
      forbidden_asset_types: ['wesmart_logo', 'tig_org_logo'],
    },
  },
};

const officialAssets = [
  { id: 'asset-wesmart', brand_id: 'culture_activity', asset_type: 'wesmart_logo', status: 'active' },
  { id: 'asset-tig', brand_id: 'culture_activity', asset_type: 'tig_org_logo', status: 'active' },
];

test('approved OpenTalk template wins and exposes only allowlisted replacement fields', () => {
  const plan = resolveGenerationPlan({
    task: { title: 'OpenTalk AI 分享', activity_type: 'OpenTalk' },
    pageNo: 1,
    brandRules: [genericRule, cultureRule],
    brandAssets: officialAssets,
    approvedTemplates: [{
      id: 'template-opentalk',
      name: 'OpenTalk V1',
      template_family: 'OpenTalk',
      status: 'approved',
      template_mode: 'replace_content',
      brand_rule_id: 'rule-culture',
      template_asset_url: 'https://example.supabase.co/storage/v1/object/public/designs/templates/opentalk.svg',
      rules: {
        generation_enabled: true,
        editable_area: [{ id: 'copy' }],
        locked_area: [{ id: 'layout' }],
        variable_slots: ['title', 'subtitle', 'speaker', 'time', 'location', 'qr_code', 'content', 'background'],
      },
    }],
  });
  assert.equal(plan.mode, 'replace_content');
  assert.equal(plan.template.id, 'template-opentalk');
  assert.deepEqual(plan.editableFields, ['title', 'speaker', 'time', 'location', 'qr_code', 'content']);
  assert.deepEqual(plan.lockedFields, ['layout', 'logo_position', 'brand_area', 'fixed_components']);
  assert.equal(plan.publishable, true);
});

test('cultural P1 uses Creative Area and requires both official assets', () => {
  const plan = resolveGenerationPlan({
    task: { activity_type: '内部文化活动' },
    pageNo: 1,
    brandRules: [genericRule, cultureRule],
    brandAssets: officialAssets,
  });
  assert.equal(plan.brandRule.code, 'culture_activity_default');
  assert.deepEqual(plan.creativeArea, { x: 0, y: 220, width: 1242, height: 1260 });
  assert.equal(plan.safeArea.top_left_reserved, true);
  assert.equal(plan.safeArea.bottom_reserved, true);
  assert.deepEqual(plan.requiredBrandAssets.map((asset) => asset.asset_type), ['wesmart_logo', 'tig_org_logo']);
  assert.equal(plan.publishable, true);
});

test('cultural P2 and P3 forbid all brand logo assets', () => {
  for (const pageNo of [2, 3]) {
    const plan = resolveGenerationPlan({
      task: { activity_type: '培训活动' },
      pageNo,
      brandRules: [genericRule, cultureRule],
      brandAssets: officialAssets,
    });
    assert.equal(plan.pageRule.apply_brand, false);
    assert.deepEqual(plan.forbiddenAssetTypes, ['wesmart_logo', 'tig_org_logo']);
    assert.deepEqual(plan.creativeArea, { x: 0, y: 0, width: 1242, height: 1660 });
  }
});

test('missing official logo assets fails closed instead of falling back to generic branding', () => {
  const plan = resolveGenerationPlan({
    task: { activity_type: 'TIG周年活动' },
    pageNo: 1,
    brandRules: [genericRule, { ...cultureRule, status: 'draft' }],
    brandAssets: [],
  });
  assert.equal(plan.brandRule.code, 'culture_activity_default');
  assert.equal(plan.publishable, false);
  assert.equal(plan.blockReason, 'BRAND_RULE_INACTIVE');
  assert.deepEqual(plan.missingAssetTypes, ['wesmart_logo', 'tig_org_logo']);
});

test('non-cultural work uses the active generic composer rule', () => {
  const plan = resolveGenerationPlan({
    task: { title: '产品功能示意图', activity_type: '产品设计' },
    pageNo: 1,
    brandRules: [genericRule, cultureRule],
    brandAssets: officialAssets,
  });
  assert.equal(plan.brandRule.code, 'generic_no_brand');
  assert.equal(plan.mode, 'creative_generate');
  assert.equal(plan.publishable, true);
});

test('logo-like files are removed from model inputs while non-logo brand IP remains', () => {
  const assets = filterCreativeAssets([
    { file_name: 'WeSmart.svg', asset_role: 'WeSmart Logo', data_url: 'logo-1' },
    { file_name: '科技及智能事业群-logo.svg', asset_role: '部门Logo', data_url: 'logo-2' },
    { file_name: 'tig-ip.png', asset_role: 'TIG IP', data_url: 'ip' },
    { file_name: 'speaker.jpg', asset_role: '嘉宾照片', data_url: 'speaker' },
  ]);
  assert.deepEqual(assets.map((asset) => asset.data_url), ['ip', 'speaker']);
});
