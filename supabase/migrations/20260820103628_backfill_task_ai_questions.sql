insert into public.task_ai_messages (id, task_id, sender_type, content, status, created_at)
select
  id,
  task_id,
  'ai',
  question,
  case status
    when 'open' then 'open'
    when 'answered' then 'answered'
    else 'superseded'
  end,
  created_at
from public.uat_clarifications
on conflict (id) do update
set content = excluded.content,
    status = excluded.status;
