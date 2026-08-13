select
  has_table_privilege('anon', 'public.uat_requirement_sources', 'select') as anon_can_select_sources,
  has_table_privilege('authenticated', 'public.uat_requirement_sources', 'select') as authenticated_can_select_sources;

select count(*) = 0 as authenticated_has_no_direct_write_policy
from pg_policies
where schemaname = 'public'
  and tablename in (
    'uat_requirement_sources',
    'uat_source_snapshots',
    'uat_requirement_analyses',
    'uat_clarifications',
    'uat_design_generations'
  )
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');

select policyname, cmd, with_check is not null as update_has_with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'test_tasks'
  and policyname = 'uat participants update tasks';
