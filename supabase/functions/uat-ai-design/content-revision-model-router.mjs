export const SEEDREAM_40='doubao-seedream-4-0-250828';
export const SEEDREAM_45='doubao-seedream-4-5-251128';
export const SEEDREAM_50='doubao-seedream-5-0-260128';

export function selectRevisionModel({relation}={}) {
  return relation==='quality_retry' ? SEEDREAM_50 : SEEDREAM_45;
}

export function isModelAllowedForMode(mode, model) {
  const m=String(mode||'');
  const selected=String(model||'');
  if (m==='initial_framework' || m==='framework_revision') return selected===SEEDREAM_40;
  if (m==='content_revision') return selected===SEEDREAM_45 || selected===SEEDREAM_50;
  return false;
}

export function seedreamLabel(model){
  if(model===SEEDREAM_50) return 'Seedream 5.0';
  if(model===SEEDREAM_45) return 'Seedream 4.5';
  if(model===SEEDREAM_40) return 'Seedream 4.0';
  return String(model||'Seedream');
}
