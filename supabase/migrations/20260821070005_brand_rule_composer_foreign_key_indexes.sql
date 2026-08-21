create index if not exists design_templates_brand_rule_idx
  on public.design_templates (brand_rule_id)
  where brand_rule_id is not null;

create index if not exists brand_composition_runs_brand_rule_idx
  on public.brand_composition_runs (brand_rule_id);
create index if not exists brand_composition_runs_template_idx
  on public.brand_composition_runs (template_id)
  where template_id is not null;
create index if not exists brand_composition_runs_raw_asset_idx
  on public.brand_composition_runs (raw_creative_asset_id);
create index if not exists brand_composition_runs_preview_asset_idx
  on public.brand_composition_runs (composer_preview_asset_id)
  where composer_preview_asset_id is not null;
create index if not exists brand_composition_runs_output_asset_idx
  on public.brand_composition_runs (branded_output_asset_id)
  where branded_output_asset_id is not null;
