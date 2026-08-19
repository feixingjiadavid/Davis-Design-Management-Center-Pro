export const PREVIEW_BUCKET='version-previews';

export function selectFrameworkPreviewInput(history=[]){
  for(let i=history.length-1;i>=0;i--){
    const item=history[i]||{};
    if(item.action!=='submit_framework')continue;
    const driveFileIds=Array.isArray(item.drive_file_ids)?item.drive_file_ids.map(String).map(x=>x.trim()).filter(Boolean):[];
    const previewStoragePath=String(item.preview_storage_path||'').trim();
    return {
      index:i,
      version:String(item.version||'v-1'),
      driveFileIds,
      previewStoragePath,
      needsPreview:driveFileIds.length>=3&&!previewStoragePath,
    };
  }
  return {index:-1,version:'',driveFileIds:[],previewStoragePath:'',needsPreview:false};
}

export function versionPreviewPath(taskId,version){
  const task=String(taskId||'task').trim().replace(/[^A-Za-z0-9._-]+/g,'-');
  const ver=String(version||'v-1').trim().replace(/[^A-Za-z0-9._-]+/g,'-');
  return `${task}/framework-${ver}.jpg`;
}

export function patchFrameworkHistory(history,index,path){
  return (history||[]).map((item,i)=>i===index?{
    ...item,
    preview_bucket:PREVIEW_BUCKET,
    preview_storage_path:String(path||''),
  }:{...item});
}
