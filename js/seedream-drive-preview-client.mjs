export const DEMO_MODEL='doubao-seedream-4-0-250828';
export const DEMO_VERSION='seedream-demo-creative-director-v2';
export const DRIVE_RELAY_URL='https://bjzfkwxrvytgphvgwltl.supabase.co/functions/v1/uat-seedream-drive-relay';

const objectUrlCache = new Map();

export function selectCurrentDemoPages(rows, model=DEMO_MODEL, version=DEMO_VERSION) {
  const filtered=(rows||[])
    .filter(r=>r?.kind==='demo'&&r?.model===model&&r?.prompt_version===version)
    .sort((a,b)=>new Date(a?.created_at||0)-new Date(b?.created_at||0));
  const byPage=new Map();
  for(const row of filtered) byPage.set(Number(row?.page_index||1), row);
  return [...byPage.values()].sort((a,b)=>Number(a?.page_index||1)-Number(b?.page_index||1));
}

export async function fetchDrivePreviewBlob({fetchImpl=fetch, relayUrl=DRIVE_RELAY_URL, token, fileId, timeoutMs=90000}) {
  const id=String(fileId||'').trim();
  if(!id) throw new Error('DRIVE_FILE_ID_REQUIRED');
  const jwt=String(token||'').trim();
  if(!jwt) throw new Error('UAT_SESSION_MISSING');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error('DRIVE_PREVIEW_TIMEOUT')), timeoutMs);
  try {
    const response=await fetchImpl(relayUrl,{
      method:'POST',
      headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},
      body:JSON.stringify({action:'preview',drive_file_id:id}),
      signal:controller.signal,
    });
    if(!response.ok){
      const detail=await response.text().catch(()=>'');
      throw new Error(`DRIVE_PREVIEW_HTTP_${response.status}${detail?`:${detail.slice(0,160)}`:''}`);
    }
    const type=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!type.startsWith('image/')) throw new Error(`DRIVE_PREVIEW_NOT_IMAGE:${type||'unknown'}`);
    const bytes=await response.arrayBuffer();
    if(!bytes.byteLength) throw new Error('DRIVE_PREVIEW_EMPTY');
    return new Blob([bytes],{type});
  } finally {
    clearTimeout(timer);
  }
}

async function sessionToken(supabase){
  const {data:{session}}=await supabase.auth.getSession();
  const token=String(session?.access_token||'').trim();
  if(!token) throw new Error('UAT_SESSION_MISSING');
  return token;
}

export async function getDrivePreviewObjectUrl(supabase,fileId){
  const id=String(fileId||'').trim();
  if(!id) throw new Error('DRIVE_FILE_ID_REQUIRED');
  if(objectUrlCache.has(id)) return objectUrlCache.get(id);
  const token=await sessionToken(supabase);
  const blob=await fetchDrivePreviewBlob({token,fileId:id});
  const url=URL.createObjectURL(blob);
  objectUrlCache.set(id,url);
  return url;
}

export function clearDrivePreviewCache(){
  for(const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
}
