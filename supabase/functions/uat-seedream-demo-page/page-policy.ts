const STALE_MS=4*60*1000;
export function classifyExistingPage(row:any,nowMs=Date.now()){
  if(!row) return {action:'create'};
  const status=String(row.status||'');
  if(status==='ready'||status==='confirmed') return {action:'reuse'};
  if(status==='failed') return {action:'failed'};
  if(status==='generating'){
    const created=Date.parse(String(row.created_at||''));
    if(Number.isFinite(created)&&nowMs-created>STALE_MS) return {action:'stale'};
    return {action:'wait'};
  }
  return {action:'create'};
}
