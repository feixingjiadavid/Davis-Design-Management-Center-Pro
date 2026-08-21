create extension if not exists pgcrypto;

create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  version_name text not null check (length(btrim(version_name)) > 0),
  version_type text not null check (version_type in ('framework', 'revision', 'final')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'revision', 'accepted')),
  description text not null default '',
  creator text not null check (length(btrim(creator)) > 0),
  created_at timestamptz not null default now(),
  unique (task_id, version_no)
);

create table if not exists public.design_version_assets (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references public.design_versions(id) on delete cascade,
  asset_url text not null check (length(btrim(asset_url)) > 0),
  asset_type text not null default 'image' check (length(btrim(asset_type)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (design_version_id, sort_order)
);

create table if not exists public.task_ai_messages (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  sender_type text not null check (sender_type in ('ai', 'requester')),
  content text not null check (length(btrim(content)) > 0),
  status text not null default 'sent' check (length(btrim(status)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists design_versions_task_version_idx
  on public.design_versions(task_id, version_no desc);
create index if not exists design_versions_task_status_idx
  on public.design_versions(task_id, status);
create index if not exists design_version_assets_version_sort_idx
  on public.design_version_assets(design_version_id, sort_order);
create index if not exists task_ai_messages_task_created_idx
  on public.task_ai_messages(task_id, created_at);

alter table public.design_versions enable row level security;
alter table public.design_version_assets enable row level security;
alter table public.task_ai_messages enable row level security;

drop policy if exists "task participants read design versions" on public.design_versions;
create policy "task participants read design versions"
  on public.design_versions for select to authenticated
  using ((select public.can_access_uat_ai_task(task_id)));

drop policy if exists "task participants review design versions" on public.design_versions;

drop policy if exists "task participants read design version assets" on public.design_version_assets;
create policy "task participants read design version assets"
  on public.design_version_assets for select to authenticated
  using (exists (
    select 1
    from public.design_versions version
    where version.id = design_version_id
      and (select public.can_access_uat_ai_task(version.task_id))
  ));

drop policy if exists "task participants read ai messages" on public.task_ai_messages;
create policy "task participants read ai messages"
  on public.task_ai_messages for select to authenticated
  using ((select public.can_access_uat_ai_task(task_id)));

revoke all on public.design_versions from anon, authenticated;
revoke all on public.design_version_assets from anon, authenticated;
revoke all on public.task_ai_messages from anon, authenticated;

grant select on public.design_versions to authenticated;
grant select on public.design_version_assets to authenticated;
grant select on public.task_ai_messages to authenticated;

grant all on public.design_versions to service_role;
grant all on public.design_version_assets to service_role;
grant all on public.task_ai_messages to service_role;

revoke all on public.design_versions from anon;
revoke all on public.design_version_assets from anon;
revoke all on public.task_ai_messages from anon;

do $$
begin
  if to_regclass('public.uat_clarification_messages') is not null then
    execute $backfill$
      insert into public.task_ai_messages (id, task_id, sender_type, content, status, created_at)
      select
        id,
        task_id,
        case sender_role when 'ai_designer' then 'ai' else 'requester' end,
        content,
        'sent',
        created_at
      from public.uat_clarification_messages
      where sender_role in ('ai_designer', 'requester')
      on conflict (id) do nothing
    $backfill$;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.task_ai_messages;
exception when duplicate_object then null;
end $$;
