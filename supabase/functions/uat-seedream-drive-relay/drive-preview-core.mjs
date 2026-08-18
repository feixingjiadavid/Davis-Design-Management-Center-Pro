export function isDrivePreviewAllowed(file, folder, rootId){
  if(!file?.id || !String(file.mimeType||'').startsWith('image/')) return false;
  const parent=String(file.parents?.[0]||'');
  if(!parent || String(folder?.id||'')!==parent) return false;
  return Array.isArray(folder?.parents) && folder.parents.includes(rootId);
}
