import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationDir = path.resolve('supabase/migrations');

function migrationSource() {
  const file = fs.readdirSync(migrationDir)
    .filter((name) => name.endsWith('_brand_rule_composer_foundation.sql'))
    .sort()
    .at(-1);
  assert.ok(file, 'brand rule composer migration must exist');
  return fs.readFileSync(path.join(migrationDir, file), 'utf8').toLowerCase();
}

function allBrandComposerMigrationSource() {
  return fs.readdirSync(migrationDir)
    .filter((name) => (name.includes('_brand_rule_composer_') || name.includes('_brand_composer_')) && name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'))
    .join('\n')
    .toLowerCase();
}

test('creates the brand, generation asset, and composition audit tables', () => {
  const sql = migrationSource();
  for (const table of ['brand_assets', 'brand_rules', 'ai_generation_assets', 'brand_composition_runs']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
  }
  for (const column of ['brand_id', 'asset_type', 'asset_url', 'content_sha256', 'rule_json']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  for (const column of ['raw_creative_asset_id', 'composer_preview_asset_id', 'branded_output_asset_id', 'vi_check']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
});

test('keeps brand asset types extensible and official assets empty', () => {
  const sql = migrationSource();
  assert.match(sql, /asset_type\s+text\s+not null\s+check\s*\(length\(btrim\(asset_type\)\)\s*>\s*0\)/);
  assert.doesNotMatch(sql, /asset_type\s+in\s*\(/);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.brand_assets/);
  assert.match(sql, /where\s+status\s*=\s*'active'/);
});

test('creates public brand and private generation storage buckets without client writes', () => {
  const sql = migrationSource();
  assert.match(sql, /insert into storage\.buckets[\s\S]*?'brand-assets'[\s\S]*?true/);
  assert.match(sql, /insert into storage\.buckets[\s\S]*?'ai-generation-assets'[\s\S]*?false/);
  assert.match(sql, /brand-assets public read/);
  assert.doesNotMatch(sql, /for\s+(insert|update|delete)\s+to\s+(anon|authenticated)[\s\S]*?bucket_id\s*=\s*'brand-assets'/);
  assert.doesNotMatch(sql, /for\s+(insert|update|delete)\s+to\s+(anon|authenticated)[\s\S]*?bucket_id\s*=\s*'ai-generation-assets'/);
});

test('adds template binding and formal asset lineage', () => {
  const sql = migrationSource();
  assert.match(sql, /alter table public\.design_templates[\s\S]*?add column if not exists brand_rule_id uuid/);
  assert.match(sql, /add column if not exists template_mode text/);
  assert.match(sql, /template_mode\s+is\s+null\s+or\s+template_mode\s+in\s*\('replace_content',\s*'creative_generate'\)/);
  assert.match(sql, /add column if not exists template_asset_url text/);
  assert.match(sql, /alter table public\.design_version_assets[\s\S]*?add column if not exists source_generation_asset_id uuid/);
});

test('enforces branded output and passed VI as the only formal publication source', () => {
  const sql = migrationSource();
  assert.match(sql, /create or replace function public\.enforce_branded_design_version_asset\(\)/);
  assert.match(sql, /new\.source_generation_asset_id is null[\s\S]*?raise exception/);
  assert.match(sql, /asset_role\s*=\s*'branded_output'/);
  assert.match(sql, /composition_row\.status\s*=\s*'passed'/);
  assert.match(sql, /composition_row\.vi_check[\s\S]*?'passed'/);
  assert.match(sql, /create trigger enforce_branded_design_version_asset[\s\S]*?before insert or update on public\.design_version_assets/);
  assert.doesNotMatch(sql, /history_json|drive_url|generation_url/);
});

test('uses least-privilege Data API grants and task-scoped RLS', () => {
  const sql = migrationSource();
  for (const table of ['brand_assets', 'brand_rules', 'ai_generation_assets', 'brand_composition_runs']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`grant all on public\\.${table} to service_role`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon`));
  }
  assert.match(sql, /can_access_uat_ai_task/);
  assert.match(sql, /brand assets active read/);
  assert.match(sql, /brand rules active read/);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*to authenticated/);
});

test('seeds generic active and cultural draft rules with page-specific safe areas', () => {
  const sql = migrationSource();
  assert.match(sql, /'generic_no_brand'[\s\S]*?'active'/);
  assert.match(sql, /'culture_activity_default'[\s\S]*?'draft'/);
  assert.match(sql, /top_left_reserved/);
  assert.match(sql, /bottom_reserved/);
  assert.match(sql, /wesmart_logo/);
  assert.match(sql, /tig_org_logo/);
  assert.match(sql, /replace_content/);
});

test('indexes every new foreign-key lookup used by composition and publication', () => {
  const sql = allBrandComposerMigrationSource();
  for (const index of [
    'design_templates_brand_rule_idx',
    'brand_composition_runs_brand_rule_idx',
    'brand_composition_runs_template_idx',
    'brand_composition_runs_raw_asset_idx',
    'brand_composition_runs_preview_asset_idx',
    'brand_composition_runs_output_asset_idx',
  ]) {
    assert.match(sql, new RegExp(`create index if not exists ${index}\\b`));
  }
});

test('private generation objects are readable only through task-scoped authenticated policy', () => {
  const sql = allBrandComposerMigrationSource();
  assert.match(sql, /create policy "task participants read ai generation objects"/);
  assert.match(sql, /bucket_id\s*=\s*'ai-generation-assets'/);
  assert.match(sql, /asset\.storage_path\s*=\s*name/);
  assert.match(sql, /can_access_uat_ai_task\(asset\.task_id\)/);
  assert.doesNotMatch(sql, /ai generation objects"[\s\S]*?for\s+(insert|update|delete)\s+to\s+authenticated/);
});
