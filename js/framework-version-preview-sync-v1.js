import { PREVIEW_BUCKET, selectFrameworkPreviewInput, versionPreviewPath } from './framework-version-preview-core.mjs?v=framework-preview-core-v1';
import { getDrivePreviewObjectUrl } from './seedream-drive-preview-client.mjs?v=drive-preview-v7';

let client=null;
let busy=false;
let timer=null;
const previewObjectUrls=new Map();

const pageName=()=>location.pathname.split('/').pop()||'';
const taskIdForPage=()=>{
  if(pageName()==='ai-designer-workspace.html')return String(document.querySelector('#taskList .task.active')?.dataset?.id||'').trim();
  if(pageName()==='task-detail-requester.html')return String(new URLSearchParams(location.search).get('id')||'').trim();
  return '';
};
const parseHistory=(raw)=>{if(Array.isArray(raw))return raw;try{return JSON.parse(String(raw||'[]'))}catch{return[]}};

function loadImage(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('FRAMEWORK_PREVIEW_IMAGE_DECODE_FAILED'));
    img.src=url;
  });
}

function drawContain(ctx,img,x,y,w,h){
  const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const dw=Math.max(1,Math.round(img.naturalWidth*scale));
  const dh=Math.max(1,Math.round(img.naturalHeight*scale));
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}

function canvasBlob(canvas,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('FRAMEWORK_PREVIEW_ENCODE_FAILED')),'image/jpeg',quality));
}

async function composePreview(driveFileIds){
  const urls=[];
  for(const id of driveFileIds.slice(0,3))urls.push(await getDrivePreviewObjectUrl(client,id));
  const images=await Promise.all(urls.map(loadImage));
  const canvas=document.createElement('canvas');
  canvas.width=1200;
  canvas.height=720;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('FRAMEWORK_PREVIEW_CANVAS_UNAVAILABLE');
  ctx.fillStyle='#09090b';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f8fafc';
  ctx.font='700 28px Inter, Arial, sans-serif';
  ctx.fillText('框架方案 · 3页总览',32,42);
  ctx.fillStyle='#94a3b8';
  ctx.font='500 15px Inter, Arial, sans-serif';
  ctx.fillText('P1 / P2 / P3',32,66);

  const gap=22;
  const top=88;
  const bottom=24;
  const cardW=(canvas.width-gap*4)/3;
  const cardH=canvas.height-top-bottom;
  images.forEach((img,index)=>{
    const x=gap+(cardW+gap)*index;
    ctx.fillStyle='#111827';
    ctx.fillRect(x,top,cardW,cardH);
    ctx.fillStyle='#e5e7eb';
    ctx.font='700 18px Inter, Arial, sans-serif';
    ctx.fillText(`P${index+1}`,x+16,top+28);
    drawContain(ctx,img,x+14,top+42,cardW-28,cardH-56);
  });
  let blob=await canvasBlob(canvas,0.82);
  if(blob.size>1850000)blob=await canvasBlob(canvas,0.68);
  if(blob.size>2050000)throw new Error('FRAMEWORK_PREVIEW_TOO_LARGE');
  return blob;
}

function findHistoryCard(version){
  const container=document.getElementById('version-history-container');
  if(!container)return null;
  const cards=[...container.children];
  return cards.find(card=>String(card.textContent||'').includes('框架方案')&&String(card.textContent||'').includes(version))||cards.find(card=>String(card.textContent||'').includes('框架方案'))||null;
}

function showBlobInHistoryCard(version,path,blob){
  const card=findHistoryCard(version);
  if(!card)return false;
  const image=card.querySelector('img');
  if(!image)return false;
  const previous=previewObjectUrls.get(path);
  if(previous)URL.revokeObjectURL(previous);
  const objectUrl=URL.createObjectURL(blob);
  previewObjectUrls.set(path,objectUrl);
  image.src=objectUrl;
  image.alt=`${version} 框架方案三页总览`;
  image.dataset.frameworkPreviewPath=path;
  const frame=image.parentElement;
  if(frame)frame.onclick=()=>typeof window.openPreview==='function'?window.openPreview(objectUrl):window.open(objectUrl,'_blank','noopener');
  return true;
}

async function hydrateStoredPreview(version,path){
  const card=findHistoryCard(version);
  if(!card)return false;
  const image=card.querySelector('img');
  if(!image)return false;
  if(image.dataset.frameworkPreviewPath===path&&image.src)return true;
  const {data,error}=await client.storage.from(PREVIEW_BUCKET).download(path);
  if(error)throw error;
  showBlobInHistoryCard(version,path,data);
  return true;
}

async function hydrateAllStoredPreviews(history){
  for(const item of history){
    if(item?.action!=='submit_framework')continue;
    const path=String(item.preview_storage_path||'').trim();
    if(!path)continue;
    const version=String(item.version||'v-X');
    await hydrateStoredPreview(version,path).catch(error=>console.warn('框架历史封面读取失败:',error));
  }
}

async function buildAndPersist(taskId,input){
  const blob=await composePreview(input.driveFileIds);
  const path=versionPreviewPath(taskId,input.version);
  const {error:uploadError}=await client.storage.from(PREVIEW_BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:true});
  if(uploadError)throw uploadError;
  const {data:patched,error:patchError}=await client.rpc('set_framework_preview_path',{p_task_id:taskId,p_version:input.version,p_preview_path:path});
  if(patchError)throw patchError;
  if(patched!==true)throw new Error('FRAMEWORK_PREVIEW_HISTORY_PATCH_FAILED');
  showBlobInHistoryCard(input.version,path,blob);
  window.dispatchEvent(new CustomEvent('framework-preview-ready',{detail:{taskId,version:input.version,path}}));
  return path;
}

async function syncOnce(){
  if(busy||!client)return;
  const taskId=taskIdForPage();
  if(!taskId)return;
  busy=true;
  try{
    const {data:task,error}=await client.from('test_tasks').select('id,status,history_json').eq('id',taskId).single();
    if(error||!task)return;
    const history=parseHistory(task.history_json);
    await hydrateAllStoredPreviews(history);
    const input=selectFrameworkPreviewInput(history);
    if(input.index<0||!input.needsPreview)return;
    await buildAndPersist(taskId,input);
  }catch(error){
    console.error('框架历史版本封面自动生成失败:',error);
  }finally{
    busy=false;
  }
}

export function bootstrapFrameworkVersionPreviewSync(clientInstance){
  if(typeof window==='undefined')return;
  if(!['task-detail-requester.html','ai-designer-workspace.html'].includes(pageName()))return;
  if(window.__frameworkVersionPreviewSyncV1)return;
  window.__frameworkVersionPreviewSyncV1=true;
  client=clientInstance;
  const start=()=>{
    syncOnce();
    timer=setInterval(syncOnce,4000);
    if(pageName()==='ai-designer-workspace.html')document.getElementById('taskList')?.addEventListener('click',()=>setTimeout(syncOnce,120),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('beforeunload',()=>{
    if(timer)clearInterval(timer);
    for(const url of previewObjectUrls.values())URL.revokeObjectURL(url);
    previewObjectUrls.clear();
  },{once:true});
}
