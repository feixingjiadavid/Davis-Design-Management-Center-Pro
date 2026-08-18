export function isUuid(value){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
}

export function nextPageIdempotencyKey(){
  return crypto.randomUUID();
}

export function uiPhaseKey(dbSignature,runActive){
  return `${String(dbSignature||'')}|local_run:${runActive?'1':'0'}`;
}
