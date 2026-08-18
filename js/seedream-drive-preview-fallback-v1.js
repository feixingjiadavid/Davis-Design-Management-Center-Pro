const driveThumb=id=>`https://drive.google.com/thumbnail?id=${encodeURIComponent(String(id||''))}&sz=w1600`;

function upgradePlaceholder(node){
  if(!(node instanceof HTMLElement)) return;
  const fid=String(node.dataset?.drivePreview||'').trim();
  if(!fid||node.dataset.drivePreviewFallback==='1') return;
  node.dataset.drivePreviewFallback='1';
  const img=document.createElement('img');
  img.className='w-full block bg-white';
  img.alt='Google Drive Demo preview';
  img.loading='eager';
  img.referrerPolicy='no-referrer';
  img.src=driveThumb(fid);
  img.onerror=()=>{
    node.innerHTML='<div class="min-h-[220px] flex items-center justify-center px-6 text-center text-sm text-amber-300">云盘文件已归档，但浏览器未能直接加载缩略图；请点击下方“打开云盘原图”。</div>';
  };
  node.replaceChildren(img);
}

function scan(){document.querySelectorAll('[data-drive-preview]').forEach(upgradePlaceholder)}

export function bootstrapSeedreamDrivePreviewFallback(){
  if(window.__seedreamDrivePreviewFallbackStarted) return;
  window.__seedreamDrivePreviewFallbackStarted=true;
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.body,{childList:true,subtree:true});
}
