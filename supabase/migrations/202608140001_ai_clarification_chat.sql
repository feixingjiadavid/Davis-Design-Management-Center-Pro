alter table public.uat_clarifications
  add column if not exists round integer not null default 1 check (round between 1 and 2),
  add column if not exists question_type text not null default 'hard' check (question_type in ('hard', 'soft')),
  add column if not exists closed_reason text;

create table if not exists public.uat_clarification_messages (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.test_tasks(id) on delete cascade,
  analysis_id uuid references public.uat_requirement_analyses(id) on delete set null,
  clarification_id uuid references public.uat_clarifications(id) on delete set null,
  sender_id uuid,
  sender_role text not null check (sender_role in ('requester', 'ai_designer', 'system')),
  message_type text not null default 'message' check (message_type in ('message', 'question', 'answer', 'status', 'summary')),
  content text not null check (length(btrim(content)) > 0),
  client_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uat_clarification_messages_client_request_uidx
  on public.uat_clarification_messages(task_id, client_request_id)
  where client_request_id is not null;
create index if not exists uat_clarification_messages_task_created_idx
  on public.uat_clarification_messages(task_id, created_at);

alter table public.uat_clarification_messages enable row level security;

drop policy if exists "participants read clarification messages" on public.uat_clarification_messages;
create policy "participants read clarification messages"
  on public.uat_clarification_messages for select to authenticated
  using ((select public.can_access_uat_ai_task(task_id)));

grant select on public.uat_clarification_messages to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.uat_clarification_messages;
exception when duplicate_object then null;
end $$;
