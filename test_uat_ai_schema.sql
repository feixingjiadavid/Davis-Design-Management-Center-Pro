select
  to_regclass('public.uat_requirement_sources') is not null as sources_exists,
  to_regclass('public.uat_source_snapshots') is not null as snapshots_exists,
  to_regclass('public.uat_requirement_analyses') is not null as analyses_exists,
  to_regclass('public.uat_clarifications') is not null as clarifications_exists,
  to_regclass('public.uat_design_generations') is not null as generations_exists;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'uat_requirement_sources',
    'uat_source_snapshots',
    'uat_requirement_analyses',
    'uat_clarifications',
    'uat_design_generations'
  )
order by tablename;

select count(*) = 5 as select_policy_count_is_five
from pg_policies
where schemaname = 'public'
  and tablename like 'uat_%'
  and policyname like 'participants read%';
