import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationDir = path.resolve('supabase/migrations');

function migrationSource() {
  const file = fs.readdirSync(migrationDir)
    .filter((name) => name.endsWith('_formal_design_delivery_tables.sql'))
    .sort()
    .at(-1);
  assert.ok(file, 'formal design delivery migration must exist');
  return fs.readFileSync(path.join(migrationDir, file), 'utf8').toLowerCase();
}

test('creates the formal requester delivery tables with approved fields', () => {
  const sql = migrationSource();
  for (const table of ['design_versions', 'design_version_assets', 'task_ai_messages']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
  }
  for (const column of ['version_no', 'version_name', 'version_type', 'status', 'description', 'creator']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  for (const column of ['design_version_id', 'asset_url', 'asset_type', 'sort_order']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  for (const column of ['sender_type', 'content']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
});

test('uses only the approved formal version states and sender types', () => {
  const sql = migrationSource();
  assert.match(sql, /status\s+text\s+not null[\s\S]*?check\s*\(status\s+in\s*\('draft',\s*'pending_review',\s*'revision',\s*'accepted'\)\)/);
  assert.match(sql, /sender_type\s+text\s+not null[\s\S]*?check\s*\(sender_type\s+in\s*\('ai',\s*'requester'\)\)/);
  assert.doesNotMatch(sql, /seedream|google drive|run_id|prompt|model/);
});

test('enforces task/version relationships and stable asset ordering', () => {
  const sql = migrationSource();
  assert.match(sql, /task_id\s+text\s+not null\s+references public\.test_tasks\(id\)\s+on delete cascade/);
  assert.match(sql, /design_version_id\s+uuid\s+not null\s+references public\.design_versions\(id\)\s+on delete cascade/);
  assert.match(sql, /unique\s*\(task_id,\s*version_no\)/);
  assert.match(sql, /unique\s*\(design_version_id,\s*sort_order\)/);
});

test('explicitly exposes secured tables to the Data API and service-role Edge Functions', () => {
  const sql = migrationSource();
  for (const table of ['design_versions', 'design_version_assets', 'task_ai_messages']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`grant select on public\\.${table} to authenticated`));
    assert.match(sql, new RegExp(`grant all on public\\.${table} to service_role`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon`));
  }
  assert.doesNotMatch(sql, /grant update\s*\(status\)\s+on public\.design_versions to authenticated/);
  assert.match(sql, /can_access_uat_ai_task/);
  const allSql = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8')).join('\n').toLowerCase();
  assert.match(allSql, /revoke update on public\.design_versions from authenticated/);
});

test('backfills only requester-visible AI conversation', () => {
  const sql = migrationSource();
  assert.match(sql, /insert into public\.task_ai_messages/);
  assert.match(sql, /sender_role\s+in\s*\('ai_designer',\s*'requester'\)/);
  assert.doesNotMatch(sql, /sender_role\s+in\s*\([^)]*'system'/);
});

test('disables the legacy generation trigger that writes requester delivery into history_json', () => {
  const allSql = fs.readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'))
    .join('\n')
    .toLowerCase();
  assert.match(allSql, /drop trigger if exists trg_promote_completed_ai_demo on public\.uat_design_generations/);
  assert.match(allSql, /revoke execute on function public\.promote_completed_ai_demo_to_framework\(text\)\s+from public, anon, authenticated/);
  assert.match(allSql, /to_regprocedure\('public\.promote_completed_ai_demo_to_framework\(text\)'\)/);
});

test('backfills clarification questions into canonical AI communication', () => {
  const allSql = fs.readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'))
    .join('\n')
    .toLowerCase();
  assert.match(allSql, /insert into public\.task_ai_messages[\s\S]*from public\.uat_clarifications/);
  assert.match(allSql, /case status[\s\S]*when 'open' then 'open'[\s\S]*when 'answered' then 'answered'/);
});
