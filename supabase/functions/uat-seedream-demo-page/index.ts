import { createClient } from "npm:@supabase/supabase-js@2";
import { generateSeedreamDemo, SEEDREAM_DEMO_MODEL } from "../uat-ai-design/seedream-client.ts";
import { assertCanGenerateDemo, resolveDemoSize, selectGenerationPages, selectModelInputs } from "../uat-ai-design/generation-service.ts";
import { buildCreativeDemoPrompt, DEMO_PROMPT_VERSION } from "./creative-prompt.ts";
import { classifyExistingPage } from "./page-policy.ts";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
};
const ALLOWED_EMAILS=new Set([
  "uat.requester@webank.com",
  "davis.design.ai@webank.com",
  "uat.leader@webank.com",
  "uat.admin@webank.com",
]);
function out(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:CORS});}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!supabaseUrl||!serviceKey) return out({ok:false,error:"UAT_SERVER_ENV_MISSING"},500);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const {data:auth}=await admin.auth.getUser(jwt);
  const user=auth?.user;
  if(!user) return out({ok:false,error:"Authenticated UAT account required"},401);
  const email=String(user.email||"").toLowerCase();
  if(!ALLOWED_EMAILS.has(email)) return out({ok:false,error:"UAT_CALLER_FORBIDDEN"},403);

  let body:any={};
  try{body=await req.json();}catch{return out({ok:false,error:"INVALID_JSON"},400);}
  const taskId=String(body.task_id||"").trim();
  const analysisId=String(body.analysis_id||"").trim();
  const pageIndex=Math.max(1,Number(body.page_index)||1);
  const idempotencyKey=String(body.idempotency_key||"").trim();
  const runId=String(body.run_id||"").trim();
  if(!taskId||!analysisId||!idempotencyKey) return out({ok:false,error:"DEMO_PAGE_FIELDS_REQUIRED"},400);

  const {data:idempotent}=await admin.from("uat_design_generations").select("*").eq("idempotency_key",idempotencyKey).maybeSingle();
  if(idempotent){
    const status=String(idempotent.status||"");
    return out({ok:true,status,generation:idempotent,idempotent_replay:true},status==="generating"?202:200);
  }

  const [{data:task},{data:analysis}]=await Promise.all([
    admin.from("test_tasks").select("*").eq("id",taskId).single(),
    admin.from("uat_requirement_analyses").select("*").eq("id",analysisId).eq("task_id",taskId).single(),
  ]);
  if(!task||task.assignee!=="davis.design.ai") return out({ok:false,error:"TASK_NOT_ASSIGNED_TO_AI"},400);
  if(!analysis) return out({ok:false,error:"ANALYSIS_NOT_FOUND"},400);
  try{assertCanGenerateDemo(String(analysis.status||""));}catch(error){return out({ok:false,error:error instanceof Error?error.message:String(error)},400);}

  const pages=selectGenerationPages(analysis.brief||{});
  const page=pages.find((item:any)=>Number(item.index)===pageIndex);
  if(!page) return out({ok:false,error:"DEMO_PAGE_NOT_FOUND"},400);

  const [{data:references,error:refError},{data:assets,error:assetError}]=await Promise.all([
    admin.from("uat_visual_references").select("id,file_name,data_url,note,is_primary,sort_order").eq("task_id",taskId).order("sort_order",{ascending:true}),
    admin.from("uat_design_assets").select("id,file_name,data_url,asset_role,note,sort_order").eq("task_id",taskId).order("sort_order",{ascending:true}),
  ]);
  if(refError||assetError) return out({ok:false,error:(refError||assetError)?.message||"DEMO_INPUT_READ_FAILED"},500);
  if((task.request_type==="平面视觉"||!task.request_type)&&!(references||[]).length) return out({ok:false,error:"VISUAL_REFERENCE_REQUIRED"},400);

  const {data:latest}=await admin.from("uat_design_generations")
    .select("*")
    .eq("task_id",taskId).eq("analysis_id",analysisId).eq("kind","demo")
    .eq("model",SEEDREAM_DEMO_MODEL).eq("prompt_version",DEMO_PROMPT_VERSION)
    .eq("page_index",pageIndex).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const existingPolicy=classifyExistingPage(latest);
  if(existingPolicy.action==="reuse") return out({ok:true,status:latest.status,generation:latest,reused:true});
  if(existingPolicy.action==="wait") return out({ok:true,status:"generating",generation:latest,already_running:true},202);
  if(existingPolicy.action==="stale"){
    await admin.from("uat_design_generations").update({status:"failed",error_message:"STALE_GENERATION_REQUIRES_MANUAL_RESTART",updated_at:new Date().toISOString()}).eq("id",latest.id);
    await admin.from("test_tasks").update({status:"demo_failed",summary_desc:`Seedream Demo 第 ${pageIndex} 页生成超时，已停止；请手动重新开始`}).eq("id",taskId);
    return out({ok:false,error:"STALE_GENERATION_REQUIRES_MANUAL_RESTART"},409);
  }

  const queued=await admin.from("uat_design_generations").insert({
    task_id:taskId,
    analysis_id:analysisId,
    kind:"demo",
    model:SEEDREAM_DEMO_MODEL,
    prompt_version:DEMO_PROMPT_VERSION,
    idempotency_key:idempotencyKey,
    page_index:pageIndex,
    page_count:pages.length,
    status:"generating",
    output:{run_id:runId||null},
  }).select("*").single();
  if(queued.error){
    const {data:raced}=await admin.from("uat_design_generations").select("*").eq("idempotency_key",idempotencyKey).maybeSingle();
    if(raced) return out({ok:true,status:raced.status,generation:raced,idempotent_replay:true},String(raced.status)==="generating"?202:200);
    return out({ok:false,error:queued.error.message},500);
  }

  await admin.from("test_tasks").update({status:"generating_demo",summary_desc:`Seedream 4.0 正在生成 Demo 第 ${pageIndex} / ${pages.length} 页`}).eq("id",taskId);
  await admin.from("uat_audit_log").insert({actor_id:user.id,actor_email:user.email,action:"demo_page_generation_started",task_id:taskId,details:{analysis_id:analysisId,page_index:pageIndex,page_count:pages.length,run_id:runId,prompt_version:DEMO_PROMPT_VERSION}});

  try{
    const refs=(references||[]) as any[];
    const requiredAssets=(assets||[]) as any[];
    const modelInputs=selectModelInputs(refs,requiredAssets) as any[];
    const styleReference=[...refs].sort((a,b)=>Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary))||Number(a.sort_order||0)-Number(b.sort_order||0))[0]||null;
    const prompt=buildCreativeDemoPrompt({brief:analysis.brief||{},page,styleReference,assets:requiredAssets});
    const size=resolveDemoSize(analysis.brief||{});
    const generated=await generateSeedreamDemo(
      prompt,
      size,
      modelInputs.map((item:any)=>({file_name:item.file_name,data_url:item.data_url,input_kind:item.input_kind,role:item.input_kind==="asset"?String(item.asset_role||item.file_name):"主风格参考"})),
      {taskId,pageIndex,pageCount:pages.length},
      jwt,
    );
    const output={...generated,run_id:runId||null,page_index:pageIndex,page_count:pages.length,page_title:page.title,exact_copy:page.copy,prompt_version:DEMO_PROMPT_VERSION,style_reference_count:refs.length,design_asset_count:requiredAssets.length,model_input_count:modelInputs.length};
    const updated=await admin.from("uat_design_generations").update({status:"ready",output,updated_at:new Date().toISOString()}).eq("id",queued.data.id).select("*").single();
    if(updated.error) throw updated.error;

    const {data:currentRows}=await admin.from("uat_design_generations").select("page_index,status").eq("task_id",taskId).eq("analysis_id",analysisId).eq("kind","demo").eq("model",SEEDREAM_DEMO_MODEL).eq("prompt_version",DEMO_PROMPT_VERSION).in("status",["ready","confirmed"]);
    const readyPages=new Set((currentRows||[]).map((row:any)=>Number(row.page_index)));
    const complete=pages.every((item:any)=>readyPages.has(Number(item.index)));
    await admin.from("test_tasks").update({
      status:complete?"demo_review":"generating_demo",
      summary_desc:complete?`Seedream 4.0 Demo 已生成 ${pages.length} 张，等待需求方确认`:`Seedream 4.0 Demo 第 ${pageIndex} 页已完成，准备下一页`,
    }).eq("id",taskId);
    await admin.from("uat_audit_log").insert({actor_id:user.id,actor_email:user.email,action:"demo_page_generated",task_id:taskId,details:{generation_id:updated.data.id,page_index:pageIndex,page_count:pages.length,run_id:runId,prompt_version:DEMO_PROMPT_VERSION}});
    return out({ok:true,status:"ready",generation:updated.data,complete});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await admin.from("uat_design_generations").update({status:"failed",error_message:message,updated_at:new Date().toISOString()}).eq("id",queued.data.id);
    await admin.from("test_tasks").update({status:"demo_failed",summary_desc:`Seedream Demo 第 ${pageIndex} 页生成失败：${message.slice(0,140)}`}).eq("id",taskId);
    await admin.from("uat_audit_log").insert({actor_id:user.id,actor_email:user.email,action:"demo_page_generation_failed",task_id:taskId,details:{generation_id:queued.data.id,page_index:pageIndex,page_count:pages.length,run_id:runId,error:message}});
    return out({ok:false,error:message,page_index:pageIndex},502);
  }
});
