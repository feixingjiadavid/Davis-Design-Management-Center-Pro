create extension if not exists pgcrypto;

create table public.uat_requirement_sources (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  source_type text not null check (source_type in ('tencent_doc', 'uploaded_file', 'form_fields')),
  source_url text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'reading', 'ready', 'authorization_required', 'permission_denied', 'unsupported', 'failed')),
  current_snapshot_id uuid,
  error_code text,
  error_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_location_required check (source_url is not null or storage_path is not null or source_type = 'form_fields'),
  constraint source_per_task_unique unique nulls not distinct (task_id, source_url, storage_path, source_type)
);

create table public.uat_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.uat_requirement_sources(id) on delete cascade,
  title text not null default '',
  plain_text text not null,
  structured_blocks jsonb not null default '[]'::jsonb,
  image_observations jsonb not null default '[]'::jsonb,
  content_sha256 text not null,
  character_count integer not null default 0 check (character_count >= 0),
  table_count integer not null default 0 check (table_count >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  attachment_count integer not null default 0 check (attachment_count >= 0),
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint snapshot_content_unique unique (source_id, content_sha256)
);

alter table public.uat_requirement_sources
  add constraint uat_requirement_sources_current_snapshot_fkey
  foreign key (current_snapshot_id) references public.uat_source_snapshots(id) on delete set null;

create table public.uat_requirement_analyses (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  snapshot_ids uuid[] not null default '{}'::uuid[],
  version integer not null check (version > 0),
  status text not null check (status in ('analyzing', 'clarification_required', 'understanding_ready', 'confirmed', 'stale', 'failed')),
  model text not null,
  prompt_version text not null,
  brief jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  usage jsonb not null default '{}'::jsonb,
  error_message text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_version_unique unique (task_id, version),
  constraint analysis_confirmation_complete check ((confirmed_by is null and confirmed_at is null) or (confirmed_by is not null and confirmed_at is not null))
);

create table public.uat_clarifications (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  analysis_id uuid not null references public.uat_requirement_analyses(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'open' check (status in ('open', 'answered', 'superseded')),
  answered_by uuid references auth.users(id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint clarification_answer_complete check ((answer is null and answered_by is null and answered_at is null) or (answer is not null and answered_by is not null and answered_at is not null))
);

create table public.uat_design_generations (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  analysis_id uuid not null references public.uat_requirement_analyses(id) on delete restrict,
  parent_generation_id uuid references public.uat_design_generations(id) on delete set null,
  kind text not null check (kind in ('demo', 'final')),
  model text not null,
  prompt_version text not null,
  idempotency_key uuid not null unique,
  status text not null check (status in ('queued', 'generating', 'ready', 'confirmed', 'failed', 'cancelled')),
  output jsonb not null default '{}'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  error_message text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_confirmation_complete check ((confirmed_by is null and confirmed_at is null) or (confirmed_by is not null and confirmed_at is not null))
);

create index uat_requirement_sources_task_idx on public.uat_requirement_sources(task_id, status);
create index uat_requirement_sources_created_by_idx on public.uat_requirement_sources(created_by);
create index uat_requirement_sources_current_snapshot_idx on public.uat_requirement_sources(current_snapshot_id);
create index uat_source_snapshots_source_idx on public.uat_source_snapshots(source_id, created_at desc);
create index uat_requirement_analyses_task_idx on public.uat_requirement_analyses(task_id, version desc);
create index uat_requirement_analyses_confirmed_by_idx on public.uat_requirement_analyses(confirmed_by);
create index uat_clarifications_task_idx on public.uat_clarifications(task_id, status);
create index uat_clarifications_analysis_idx on public.uat_clarifications(analysis_id);
create index uat_clarifications_answered_by_idx on public.uat_clarifications(answered_by);
create index uat_design_generations_task_idx on public.uat_design_generations(task_id, kind, created_at desc);
create index uat_design_generations_analysis_idx on public.uat_design_generations(analysis_id);
create index uat_design_generations_parent_idx on public.uat_design_generations(parent_generation_id);
create index uat_design_generations_confirmed_by_idx on public.uat_design_generations(confirmed_by);

create or replace function public.can_access_uat_ai_task(p_task_id text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.test_tasks t
    where t.id = p_task_id
      and (
        (lower(coalesce(auth.jwt()->>'email', '')) = 'uat.requester@webank.com' and t.creator = 'uat.requester')
        or (lower(coalesce(auth.jwt()->>'email', '')) = 'davis.design.ai@webank.com' and t.assignee = 'davis.design.ai')
        or lower(coalesce(auth.jwt()->>'email', '')) in ('uat.leader@webank.com', 'uat.admin@webank.com')
      )
  );
$$;

revoke all on function public.can_access_uat_ai_task(text) from public, anon;
grant execute on function public.can_access_uat_ai_task(text) to authenticated;

alter table public.uat_requirement_sources enable row level security;
alter table public.uat_source_snapshots enable row level security;
alter table public.uat_requirement_analyses enable row level security;
alter table public.uat_clarifications enable row level security;
alter table public.uat_design_generations enable row level security;

create policy "participants read requirement sources"
on public.uat_requirement_sources for select to authenticated
using ((select public.can_access_uat_ai_task(task_id)));

create policy "participants read source snapshots"
on public.uat_source_snapshots for select to authenticated
using (exists (
  select 1 from public.uat_requirement_sources s
  where s.id = source_id and (select public.can_access_uat_ai_task(s.task_id))
));

create policy "participants read requirement analyses"
on public.uat_requirement_analyses for select to authenticated
using ((select public.can_access_uat_ai_task(task_id)));

create policy "participants read clarifications"
on public.uat_clarifications for select to authenticated
using ((select public.can_access_uat_ai_task(task_id)));

create policy "participants read design generations"
on public.uat_design_generations for select to authenticated
using ((select public.can_access_uat_ai_task(task_id)));

grant select on public.uat_requirement_sources to authenticated;
grant select on public.uat_source_snapshots to authenticated;
grant select on public.uat_requirement_analyses to authenticated;
grant select on public.uat_clarifications to authenticated;
grant select on public.uat_design_generations to authenticated;
revoke all on public.uat_requirement_sources from anon;
revoke all on public.uat_source_snapshots from anon;
revoke all on public.uat_requirement_analyses from anon;
revoke all on public.uat_clarifications from anon;
revoke all on public.uat_design_generations from anon;

drop policy if exists "uat participants update tasks" on public.test_tasks;
create policy "uat participants update tasks"
on public.test_tasks for update to authenticated
using (lower(coalesce((select auth.jwt())->>'email', '')) in ('uat.requester@webank.com', 'davis.design.ai@webank.com', 'uat.leader@webank.com', 'uat.admin@webank.com'))
with check (lower(coalesce((select auth.jwt())->>'email', '')) in ('uat.requester@webank.com', 'davis.design.ai@webank.com', 'uat.leader@webank.com', 'uat.admin@webank.com'));
