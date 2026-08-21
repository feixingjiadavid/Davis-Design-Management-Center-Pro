update storage.buckets
set allowed_mime_types = array_append(
      coalesce(allowed_mime_types, '{}'::text[]),
      'image/svg+xml'
    ),
    updated_at = now()
where id = 'designs'
  and not ('image/svg+xml' = any(coalesce(allowed_mime_types, '{}'::text[])));

