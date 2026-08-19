export function isLeaderUser(user={}) {
  const enName=String(user.enName||'').toLowerCase();
  const accountType=String(user.account_type||'').toLowerCase();
  const role=String(user.role||'').toLowerCase();
  return enName==='judyzzhang'||accountType==='uat_leader'||role==='leader';
}

function outputOf(row){
  if(row?.output&&typeof row.output==='object')return row.output;
  try{return JSON.parse(String(row?.output||'{}'))}catch{return{}};
}

export function selectHdPages(rows=[]) {
  const latest=new Map();
  [...rows]
    .sort((a,b)=>Date.parse(String(a.created_at||''))-Date.parse(String(b.created_at||'')))
    .forEach((row)=>latest.set(Number(row.page_index||1),row));
  return [...latest.entries()]
    .sort((a,b)=>a[0]-b[0])
    .map(([page,row])=>({page,row,fileId:String(outputOf(row).drive_file_id||'').trim()}))
    .filter(({row,fileId})=>['ready','confirmed'].includes(String(row.status))&&fileId);
}

export function defaultReviewMode(){
  return 'overview';
}

export function computeOverviewCardSize({
  viewportWidth,
  viewportHeight,
  pageCount=3,
  aspectRatio=1242/1660,
  gap=16,
  horizontalPadding=48,
  chromeHeight=132,
}={}) {
  const columns=Math.max(1,Number(pageCount)||1);
  const availableWidth=Math.max(1,(Number(viewportWidth)||1)-horizontalPadding);
  const availableHeight=Math.max(1,(Number(viewportHeight)||1)-chromeHeight);
  const widthFromHorizontal=(availableWidth-gap*(columns-1))/columns;
  const widthFromVertical=availableHeight*aspectRatio;
  const cardWidth=Math.max(1,Math.min(widthFromHorizontal,widthFromVertical));
  const cardHeight=cardWidth/aspectRatio;
  const totalWidth=cardWidth*columns+gap*(columns-1);
  return {columns,availableWidth,availableHeight,cardWidth,cardHeight,totalWidth,gap};
}
