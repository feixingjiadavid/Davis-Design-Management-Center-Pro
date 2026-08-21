create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-assets', 'brand-assets', true, 5242880, array['image/svg+xml']),
  ('ai-generation-assets', 'ai-generation-assets', false, 20971520, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null check (length(btrim(brand_id)) > 0),
  asset_type text not null check (length(btrim(asset_type)) > 0),
  asset_url text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  content_sha256 text,
  intrinsic_width numeric,
  intrinsic_height numeric,
  rule_json jsonb not null default '{}'::jsonb check (jsonb_typeof(rule_json) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'active'
    or (
      length(btrim(asset_url)) > 0
      and storage_bucket = 'brand-assets'
      and length(btrim(storage_path)) > 0
      and mime_type = 'image/svg+xml'
      and content_sha256 ~ '^[0-9a-f]{64}$'
      and intrinsic_width > 0
      and intrinsic_height > 0
    )
  )
);

create unique index if not exists brand_assets_one_active_type_idx
  on public.brand_assets (brand_id, asset_type)
  where status = 'active';
create index if not exists brand_assets_brand_status_idx
  on public.brand_assets (brand_id, status);

create table if not exists public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  brand_id text not null check (length(btrim(brand_id)) > 0),
  activity_types text[] not null default '{}'::text[],
  canvas_width integer not null check (canvas_width > 0),
  canvas_height integer not null check (canvas_height > 0),
  required_asset_types text[] not null default '{}'::text[],
  page_rules jsonb not null check (jsonb_typeof(page_rules) = 'object'),
  template_mode text not null default 'creative_generate'
    check (template_mode in ('replace_content', 'creative_generate')),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_rules_activity_types_idx
  on public.brand_rules using gin (activity_types);
create index if not exists brand_rules_brand_status_idx
  on public.brand_rules (brand_id, status);

create or replace function public.validate_brand_rule_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  missing_asset_type text;
begin
  if new.status = 'active' and cardinality(new.required_asset_types) > 0 then
    select required_type
      into missing_asset_type
    from unnest(new.required_asset_types) as required_type
    where not exists (
      select 1
      from public.brand_assets asset
      where asset.brand_id = new.brand_id
        and asset.asset_type = required_type
        and asset.status = 'active'
    )
    limit 1;

    if missing_asset_type is not null then
      raise exception 'BRAND_ASSET_REQUIRED:%', missing_asset_type
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_brand_rule_activation() from public, anon, authenticated;

drop trigger if exists validate_brand_rule_activation on public.brand_rules;
create trigger validate_brand_rule_activation
before insert or update of status, required_asset_types, brand_id on public.brand_rules
for each row execute function public.validate_brand_rule_activation();

create table if not exists public.ai_generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.uat_design_generations(id) on delete cascade,
  task_id text not null references public.test_tasks(id) on delete cascade,
  page_index integer not null check (page_index > 0),
  asset_role text not null check (asset_role in ('raw_creative', 'composer_preview', 'branded_output')),
  asset_url text not null check (length(btrim(asset_url)) > 0),
  storage_bucket text not null,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  mime_type text not null check (mime_type like 'image/%'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (asset_role in ('raw_creative', 'composer_preview') and storage_bucket = 'ai-generation-assets')
    or (asset_role = 'branded_output' and storage_bucket = 'designs')
  )
);

create unique index if not exists ai_generation_assets_one_raw_idx
  on public.ai_generation_assets (generation_id)
  where asset_role = 'raw_creative';
create index if not exists ai_generation_assets_task_created_idx
  on public.ai_generation_assets (task_id, created_at desc);
create index if not exists ai_generation_assets_generation_role_idx
  on public.ai_generation_assets (generation_id, asset_role);

create table if not exists public.brand_composition_runs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  generation_id uuid not null references public.uat_design_generations(id) on delete cascade,
  page_index integer not null check (page_index > 0),
  brand_rule_id uuid not null references public.brand_rules(id) on delete restrict,
  template_id uuid references public.design_templates(id) on delete restrict,
  raw_creative_asset_id uuid not null references public.ai_generation_assets(id) on delete restrict,
  composer_preview_asset_id uuid references public.ai_generation_assets(id) on delete restrict,
  branded_output_asset_id uuid references public.ai_generation_assets(id) on delete restrict,
  composition_manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(composition_manifest) = 'object'),
  vi_check jsonb not null default '{}'::jsonb check (jsonb_typeof(vi_check) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'composing', 'checking', 'passed', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status in ('passed', 'failed')) = (completed_at is not null)),
  check (status <> 'passed' or branded_output_asset_id is not null),
  check (status <> 'passed' or coalesce((vi_check ->> 'passed')::boolean, false))
);

create index if not exists brand_composition_runs_task_created_idx
  on public.brand_composition_runs (task_id, created_at desc);
create index if not exists brand_composition_runs_generation_status_idx
  on public.brand_composition_runs (generation_id, status);
create unique index if not exists brand_composition_runs_one_passed_generation_idx
  on public.brand_composition_runs (generation_id)
  where status = 'passed';

alter table public.design_templates
  add column if not exists brand_rule_id uuid references public.brand_rules(id) on delete restrict,
  add column if not exists template_mode text,
  add column if not exists template_asset_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.design_templates'::regclass
      and conname = 'design_templates_template_mode_check'
  ) then
    alter table public.design_templates
      add constraint design_templates_template_mode_check
      check (template_mode is null or template_mode in ('replace_content', 'creative_generate'));
  end if;
end;
$$;

alter table public.design_version_assets
  add column if not exists source_generation_asset_id uuid
    references public.ai_generation_assets(id) on delete restrict;

create index if not exists design_version_assets_source_generation_idx
  on public.design_version_assets (source_generation_asset_id)
  where source_generation_asset_id is not null;

create or replace function public.enforce_branded_design_version_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_asset public.ai_generation_assets%rowtype;
  composition public.brand_composition_runs%rowtype;
  version_task_id text;
begin
  if new.source_generation_asset_id is null then
    raise exception 'FORMAL_ASSET_REQUIRES_BRANDED_OUTPUT'
      using errcode = '23514';
  end if;

  select * into source_asset
  from public.ai_generation_assets
  where id = new.source_generation_asset_id;

  if not found
    or source_asset.asset_role <> 'branded_output'
    or source_asset.storage_bucket <> 'designs' then
    raise exception 'FORMAL_ASSET_SOURCE_NOT_BRANDED_OUTPUT'
      using errcode = '23514';
  end if;

  select composition_row.* into composition
  from public.brand_composition_runs composition_row
  where composition_row.branded_output_asset_id = source_asset.id
    and composition_row.status = 'passed'
    and coalesce((composition_row.vi_check ->> 'passed')::boolean, false)
  order by composition_row.completed_at desc
  limit 1;

  if not found or composition.status <> 'passed' then
    raise exception 'FORMAL_ASSET_VI_CHECK_NOT_PASSED'
      using errcode = '23514';
  end if;

  select task_id into version_task_id
  from public.design_versions
  where id = new.design_version_id;

  if version_task_id is null or version_task_id <> source_asset.task_id then
    raise exception 'FORMAL_ASSET_TASK_MISMATCH'
      using errcode = '23514';
  end if;

  if new.asset_url <> source_asset.asset_url then
    raise exception 'FORMAL_ASSET_URL_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_branded_design_version_asset() from public, anon, authenticated;

drop trigger if exists enforce_branded_design_version_asset on public.design_version_assets;
create trigger enforce_branded_design_version_asset
before insert or update on public.design_version_assets
for each row execute function public.enforce_branded_design_version_asset();

alter table public.brand_assets enable row level security;
alter table public.brand_rules enable row level security;
alter table public.ai_generation_assets enable row level security;
alter table public.brand_composition_runs enable row level security;

drop policy if exists "brand assets active read" on public.brand_assets;
create policy "brand assets active read"
  on public.brand_assets for select to authenticated
  using (status = 'active');

drop policy if exists "brand rules active read" on public.brand_rules;
create policy "brand rules active read"
  on public.brand_rules for select to authenticated
  using (status = 'active');

drop policy if exists "task participants read generation assets" on public.ai_generation_assets;
create policy "task participants read generation assets"
  on public.ai_generation_assets for select to authenticated
  using ((select public.can_access_uat_ai_task(task_id)));

drop policy if exists "task participants read composition runs" on public.brand_composition_runs;
create policy "task participants read composition runs"
  on public.brand_composition_runs for select to authenticated
  using ((select public.can_access_uat_ai_task(task_id)));

revoke all on public.brand_assets from anon, authenticated;
revoke all on public.brand_rules from anon, authenticated;
revoke all on public.ai_generation_assets from anon, authenticated;
revoke all on public.brand_composition_runs from anon, authenticated;

grant select on public.brand_assets to authenticated;
grant select on public.brand_rules to authenticated;
grant select on public.ai_generation_assets to authenticated;
grant select on public.brand_composition_runs to authenticated;

grant all on public.brand_assets to service_role;
grant all on public.brand_rules to service_role;
grant all on public.ai_generation_assets to service_role;
grant all on public.brand_composition_runs to service_role;

revoke all on public.brand_assets from anon;
revoke all on public.brand_rules from anon;
revoke all on public.ai_generation_assets from anon;
revoke all on public.brand_composition_runs from anon;

drop policy if exists "brand-assets public read" on storage.objects;
create policy "brand-assets public read"
  on storage.objects for select to public
  using (bucket_id = 'brand-assets');

insert into public.brand_rules (
  code,
  brand_id,
  activity_types,
  canvas_width,
  canvas_height,
  required_asset_types,
  page_rules,
  template_mode,
  status
)
values
  (
    'generic_no_brand',
    'system_default',
    '{}'::text[],
    1242,
    1660,
    '{}'::text[],
    '{"default":{"apply_brand":false,"canvas":{"x":0,"y":0,"width":1242,"height":1660},"creative_area":{"x":0,"y":0,"width":1242,"height":1660,"locked":false},"brand_safe_area":{"top_left_reserved":false,"bottom_reserved":false},"forbidden_asset_types":[]}}'::jsonb,
    'creative_generate',
    'active'
  ),
  (
    'culture_activity_default',
    'culture_activity',
    array['OpenTalk', 'TIG周年活动', 'AICoding分享', '培训活动', '内部文化活动'],
    1242,
    1660,
    array['wesmart_logo', 'tig_org_logo'],
    '{"1":{"apply_brand":true,"canvas":{"x":0,"y":0,"width":1242,"height":1660},"brand_area":{"x":0,"y":0,"width":1242,"height":220,"locked":true},"creative_area":{"x":0,"y":220,"width":1242,"height":1260,"locked":false},"brand_footer_area":{"x":0,"y":1480,"width":1242,"height":180,"locked":true},"brand_safe_area":{"top_left_reserved":true,"bottom_reserved":true},"placements":{"wesmart_logo":{"x":72,"y":64,"max_width":300,"max_height":84,"preserve_aspect_ratio":true},"tig_org_logo":{"x":72,"y":1516,"max_width":1098,"max_height":80,"align":"center","preserve_aspect_ratio":true}},"brand_background":"#FFFFFF"},"default":{"apply_brand":false,"canvas":{"x":0,"y":0,"width":1242,"height":1660},"creative_area":{"x":0,"y":0,"width":1242,"height":1660,"locked":false},"brand_safe_area":{"top_left_reserved":false,"bottom_reserved":false},"forbidden_asset_types":["wesmart_logo","tig_org_logo"]}}'::jsonb,
    'replace_content',
    'draft'
  )
on conflict (code) do update
set brand_id = excluded.brand_id,
    activity_types = excluded.activity_types,
    canvas_width = excluded.canvas_width,
    canvas_height = excluded.canvas_height,
    required_asset_types = excluded.required_asset_types,
    page_rules = excluded.page_rules,
    template_mode = excluded.template_mode,
    updated_at = now();
