import { createClient } from 'npm:@supabase/supabase-js@2';
import { archiveStorageObject, driveConfigured } from '../uat-seedream-demo-page/drive-archive.ts';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const ALLOWED=new Set(['uat.requester@webank.com','davis.design.ai@webank.com','uat.leader@webank.com','uat.admin@webank.com']);
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const url=String(Deno.env.get('SUPABASE_URL')||''),key=String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth}=await admin.auth.getUser(jwt);const user=auth?.user;
  if(!user)return out({ok:false,error:'AUTH_REQUIRED'},401);
  if(!ALLOWED.has(String(user.email||'').toLowerCase()))return out({ok:false,error:'FORBIDDEN'},403);
  if(!driveConfigured())return out({ok:false,error:'GOOGLE_DRIVE_OAUTH_NOT_CONFIGURED'},503);
  const body=await req.json().catch(()=>({}));const generationId=String(body?.generation_id||'').trim();
  if(!generationId)return out({ok:false,error:'GENERATION_ID_REQUIRED'},400);
  const {data:row}=await admin.from('uat_design_generations').select('*').eq('id',generationId).single();
  if(!row||!['ready','confirmed'].includes(String(row.status)))return out({ok:false,error:'READY_GENERATION_REQUIRED'},400);
  const storagePath=String(row.output?.storage_path||'').trim();if(!storagePath)return out({ok:false,error:'PERSISTED_STORAGE_PATH_REQUIRED'},400);
  try{
    const drive=await archiveStorageObject(admin,{taskId:String(row.task_id),pageIndex:Number(row.page_index||1),storagePath});
    const output={...(row.output||{}),...drive};
    const updated=await admin.from('uat_design_generations').update({output,updated_at:new Date().toISOString()}).eq('id',row.id).select('*').single();if(updated.error)throw updated.error;
    await admin.from('uat_audit_log').insert({actor_id:user.id,actor_email:user.email,action:'demo_drive_archived',task_id:row.task_id,details:{generation_id:row.id,page_index:row.page_index,drive_file_id:drive.drive_file_id}});
    return out({ok:true,generation:updated.data,drive});
  }catch(error){return out({ok:false,error:error instanceof Error?error.message:String(error)},502);}
});
