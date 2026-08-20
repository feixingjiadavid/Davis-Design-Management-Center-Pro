let timer=null,attempts=0,lastKick=0;

function looksStuck(){
  const title=String(document.getElementById('req-title-display')?.textContent||'');
  const reqId=String(document.getElementById('req-id')?.textContent||'');
  const body=String(document.body?.innerText||'');
  return /读取中|同步需求数据|识别身份|面板初始化/.test(`${title} ${reqId} ${body.slice(0,1800)}`);
}

function kick(){
  if(typeof window.initApp!=='function'||!window.supabase)return;
  const now=Date.now();
  if(now-lastKick<4000)return;
  lastKick=now;
  attempts+=1;
  try{window.initApp()}catch(error){console.error('需求方页面恢复启动失败',error)}
}

export function bootstrapRequesterRecovery(){
  if((location.pathname.split('/').pop()||'')!=='task-detail-requester.html'||window.__requesterBootstrapRecoveryV1)return;
  window.__requesterBootstrapRecoveryV1=true;
  const start=()=>{
    timer=setInterval(()=>{
      if(!looksStuck()){
        clearInterval(timer);
        return;
      }
      if(window.supabase)kick();
      if(attempts>=6){
        clearInterval(timer);
        const target=document.getElementById('req-title-display');
        if(target&&/读取中|同步/.test(String(target.textContent||'')))target.textContent='页面连接恢复中，请稍后重试';
        console.error('需求方页面连续恢复未完成，请检查网络或控制台错误');
      }
    },1000);
    setTimeout(()=>{if(looksStuck())kick()},1200);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
}
