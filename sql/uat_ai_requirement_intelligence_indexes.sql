create index uat_requirement_sources_created_by_idx on public.uat_requirement_sources(created_by);
create index uat_requirement_sources_current_snapshot_idx on public.uat_requirement_sources(current_snapshot_id);
create index uat_requirement_analyses_confirmed_by_idx on public.uat_requirement_analyses(confirmed_by);
create index uat_clarifications_analysis_idx on public.uat_clarifications(analysis_id);
create index uat_clarifications_answered_by_idx on public.uat_clarifications(answered_by);
create index uat_design_generations_analysis_idx on public.uat_design_generations(analysis_id);
create index uat_design_generations_parent_idx on public.uat_design_generations(parent_generation_id);
create index uat_design_generations_confirmed_by_idx on public.uat_design_generations(confirmed_by);

drop policy if exists "uat participants update tasks" on public.test_tasks;
create policy "uat participants update tasks"
on public.test_tasks for update to authenticated
using (lower(coalesce((select auth.jwt())->>'email', '')) in ('uat.requester@webank.com', 'davis.design.ai@webank.com', 'uat.leader@webank.com', 'uat.admin@webank.com'))
with check (lower(coalesce((select auth.jwt())->>'email', '')) in ('uat.requester@webank.com', 'davis.design.ai@webank.com', 'uat.leader@webank.com', 'uat.admin@webank.com'));
