insert into public.brand_assets (
  brand_id,
  asset_type,
  asset_url,
  storage_bucket,
  storage_path,
  mime_type,
  content_sha256,
  intrinsic_width,
  intrinsic_height,
  rule_json,
  status
)
values
  (
    'culture_activity',
    'wesmart_logo',
    'https://bjzfkwxrvytgphvgwltl.supabase.co/storage/v1/object/public/brand-assets/official/wesmart-color.svg',
    'brand-assets',
    'official/wesmart-color.svg',
    'image/svg+xml',
    'cb48493455bbd7d2cdf86adc9f83239b4ca3dc7c089dd55965c45893ba92bc63',
    5573.68,
    2377.53,
    '{"source":"official_google_drive","variant":"color","locked":true}'::jsonb,
    'active'
  ),
  (
    'culture_activity',
    'tig_org_logo',
    'https://bjzfkwxrvytgphvgwltl.supabase.co/storage/v1/object/public/brand-assets/official/technology-group-color.svg',
    'brand-assets',
    'official/technology-group-color.svg',
    'image/svg+xml',
    '232182a5862fc27289b7f8ce529541e85d75f1b420521295101f1892fb24a5bf',
    14298.99,
    890.39,
    '{"source":"official_google_drive","variant":"color","locked":true}'::jsonb,
    'active'
  )
on conflict (brand_id, asset_type) where status = 'active' do update
set asset_url = excluded.asset_url,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    content_sha256 = excluded.content_sha256,
    intrinsic_width = excluded.intrinsic_width,
    intrinsic_height = excluded.intrinsic_height,
    rule_json = excluded.rule_json,
    updated_at = now();

update public.brand_rules
set activity_types = array[
      '小蓝书',
      'TIG合作社',
      'OpenTalk',
      'TIG周年活动',
      'AICoding分享',
      '培训活动',
      '内部文化活动'
    ],
    canvas_width = 1242,
    canvas_height = 1660,
    required_asset_types = array['wesmart_logo', 'tig_org_logo'],
    page_rules = '{"1":{"apply_brand":true,"canvas":{"x":0,"y":0,"width":1242,"height":1660},"brand_area":{"x":0,"y":0,"width":1242,"height":220,"locked":true},"creative_area":{"x":0,"y":220,"width":1242,"height":1260,"locked":false},"brand_footer_area":{"x":0,"y":1480,"width":1242,"height":180,"locked":true},"brand_safe_area":{"top_left_reserved":true,"bottom_reserved":true},"placements":{"wesmart_logo":{"x":72,"y":64,"max_width":178,"max_height":84,"preserve_aspect_ratio":true},"tig_org_logo":{"x":72,"y":1516,"max_width":1098,"max_height":80,"align":"center","preserve_aspect_ratio":true}},"brand_background":"#FFFFFF"},"default":{"apply_brand":false,"canvas":{"x":0,"y":0,"width":1242,"height":1660},"creative_area":{"x":0,"y":0,"width":1242,"height":1660,"locked":false},"brand_safe_area":{"top_left_reserved":false,"bottom_reserved":false},"forbidden_asset_types":["wesmart_logo","tig_org_logo"]}}'::jsonb,
    template_mode = 'replace_content',
    status = 'active',
    updated_at = now()
where code = 'culture_activity_default';

