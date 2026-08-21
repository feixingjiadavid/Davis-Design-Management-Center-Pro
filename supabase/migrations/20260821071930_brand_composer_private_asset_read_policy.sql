drop policy if exists "task participants read ai generation objects" on storage.objects;
create policy "task participants read ai generation objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ai-generation-assets'
    and exists (
      select 1
      from public.ai_generation_assets asset
      where asset.storage_bucket = bucket_id
        and asset.storage_path = name
        and (select public.can_access_uat_ai_task(asset.task_id))
    )
  );
