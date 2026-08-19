create table if not exists public.uat_framework_adjustments (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  based_on_framework_version text not null,
  leader_feedback text,
  requester_direction text not null check (length(btrim(requester_direction)) > 0),
  supplemental_content text,
  refresh_tencent_doc boolean not null default false,
  created_by uuid not null,
  consumed_by_analysis_id uuid references public.uat_requirement_analyses(id),
  created_at timestamptz not null default now()
);

create table if not exists public.uat_framework_templates (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique references public.test_tasks(id) on delete cascade,
  framework_version text not null,
  analysis_id uuid references public.uat_requirement_analyses(id),
  approved_by uuid not null,
  approved_by_label text not null,
  approved_at timestamptz not null,
  approval_note text,
  page_count integer not null check (page_count > 0),
  width integer not null,
  height integer not null,
  source_content_hash text,
  pages jsonb not null check (jsonb_typeof(pages)='array'),
  created_at timestamptz not null default now()
);

create table if not exists public.uat_content_revisions (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  template_id uuid not null references public.uat_framework_templates(id) on delete restrict,
  analysis_id uuid references public.uat_requirement_analyses(id),
  revision_no integer not null check (revision_no > 0),
  source_mode text not null check (source_mode in ('tencent_doc','system_text','combined')),
  system_content text,
  previous_content_hash text,
  new_content_hash text,
  change_summary jsonb not null default '{}'::jsonb,
  affected_pages integer[] not null default '{}',
  page_manifest jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft','content_ready','generation_requested','generating','ready_for_review','capacity_conflict','failed','accepted')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  generated_at timestamptz,
  unique(task_id, revision_no)
);

alter table public.uat_design_generations add column if not exists framework_adjustment_id uuid references public.uat_framework_adjustments(id);
alter table public.uat_design_generations add column if not exists template_id uuid references public.uat_framework_templates(id);
alter table public.uat_design_generations add column if not exists revision_id uuid references public.uat_content_revisions(id);
alter table public.uat_design_generations add column if not exists generation_mode text;

create index if not exists idx_framework_adjustments_task_created on public.uat_framework_adjustments(task_id,created_at desc);
create index if not exists idx_content_revisions_task_revision on public.uat_content_revisions(task_id,revision_no desc);
create index if not exists idx_generations_revision_page on public.uat_design_generations(revision_id,page_index);

alter table public.uat_framework_adjustments enable row level security;
alter table public.uat_framework_templates enable row level security;
alter table public.uat_content_revisions enable row level security;

create policy "authenticated read framework adjustments" on public.uat_framework_adjustments for select to authenticated using (true);
create policy "authenticated read framework templates" on public.uat_framework_templates for select to authenticated using (true);
create policy "authenticated read content revisions" on public.uat_content_revisions for select to authenticated using (true);
