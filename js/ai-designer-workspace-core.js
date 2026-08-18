export function latestDemoRows(generations, model, promptVersion){
  const rows=(generations||[])
    .filter(g=>g?.kind==='demo'&&g?.model===model&&g?.prompt_version===promptVersion)
    .sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0));
  const byPage=new Map();
  for(const row of rows) byPage.set(Number(row.page_index||1),row);
  return [...byPage.values()].sort((a,b)=>Number(a.page_index||1)-Number(b.page_index||1));
}

export function demoSnapshotSignature(rows, taskStatus=''){
  return JSON.stringify({
    taskStatus:String(taskStatus||''),
    rows:(rows||[]).map(row=>({
      id:row.id,
      page:Number(row.page_index||1),
      status:String(row.status||''),
      error:String(row.error_message||''),
      image:String(row.output?.image_url||''),
      updated:String(row.updated_at||row.created_at||''),
    })),
  });
}

export function shouldPollDemo(rows, taskStatus=''){
  return String(taskStatus)==='generating_demo' || (rows||[]).some(row=>String(row.status)==='generating');
}

export function pageStates(rows,total){
  const byPage=new Map((rows||[]).map(row=>[Number(row.page_index||1),row]));
  return Array.from({length:Math.max(1,Number(total)||1)},(_,i)=>{
    const page=i+1,row=byPage.get(page);
    if(!row) return {page,status:'waiting',image_url:'',error:''};
    return {
      page,
      status:String(row.status||'waiting'),
      image_url:String(row.output?.image_url||''),
      error:String(row.error_message||''),
      row,
    };
  });
}
