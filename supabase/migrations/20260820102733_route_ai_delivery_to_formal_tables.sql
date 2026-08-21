-- The legacy UAT trigger promoted ready generation attempts into test_tasks.history_json.
-- Formal requester delivery is now published by the worker only after the complete set
-- has been persisted to Supabase Storage and written to the canonical version tables.
drop trigger if exists trg_promote_completed_ai_demo on public.uat_design_generations;

do $$
begin
  if to_regprocedure('public.promote_completed_ai_demo_to_framework(text)') is not null then
    execute 'revoke execute on function public.promote_completed_ai_demo_to_framework(text) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.trg_promote_completed_ai_demo()') is not null then
    execute 'revoke execute on function public.trg_promote_completed_ai_demo() from public, anon, authenticated, service_role';
  end if;
end $$;
