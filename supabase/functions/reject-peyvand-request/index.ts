// Supabase Edge Function: reject-peyvand-request
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,auth=req.headers.get("Authorization")||"";
 const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 try{
  const {data:{user}}=await caller.auth.getUser();if(!user)return reply({success:false,error:"ورود مدیر معتبر نیست."},401);
  const {data:role}=await admin.from("peyvand_user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(role?.role!=="owner")return reply({success:false,error:"فقط مالک اجازه رد درخواست دارد."},403);
  const {request_id}=await req.json();
  const {data:r}=await admin.from("peyvand_access_requests").select("id,auth_user_id").eq("id",request_id).eq("status","pending").maybeSingle();
  if(!r)return reply({success:false,error:"درخواست معتبر پیدا نشد."},404);
  const {error}=await admin.from("peyvand_access_requests").update({status:"rejected",reviewed_at:new Date().toISOString(),reviewed_by:user.id}).eq("id",request_id).eq("status","pending");
  if(error)return reply({success:false,error:error.message},400);
  if(r.auth_user_id)await admin.auth.admin.deleteUser(r.auth_user_id);
  return reply({success:true});
 }catch(e){return reply({success:false,error:e.message||"خطای سرور"},500);}
});