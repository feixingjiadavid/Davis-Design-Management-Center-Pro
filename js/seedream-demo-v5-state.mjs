export function shouldPollRows(rows){return (rows||[]).some(r=>['queued','generating'].includes(String(r?.status||'')));}
export function earliestActivePage(rows){const a=(rows||[]).filter(r=>['queued','generating'].includes(String(r?.status||''))).sort((x,y)=>Number(x.page_index)-Number(y.page_index));return a[0]||null;}
export function earliestFailedPage(rows){const a=(rows||[]).filter(r=>String(r?.status||'')==='failed').sort((x,y)=>Number(x.page_index)-Number(y.page_index));return a[0]||null;}
export function nextIncompletePage(rows,total){const m=new Map((rows||[]).map(r=>[Number(r.page_index),r]));for(let p=1;p<=total;p++){const r=m.get(p);if(!r||!['ready','confirmed'].includes(String(r.status)))return p;}return null;}
