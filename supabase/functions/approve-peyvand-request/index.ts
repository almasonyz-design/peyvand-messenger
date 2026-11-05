// Supabase Edge Function: approve-peyvand-request
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({success:false,error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization")||"";
 const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 try{
  const {data:{user},error:authErr}=await caller.auth.getUser();
  if(authErr||!user) return reply({success:false,error:"احراز هویت مدیر نامعتبر است."},401);
  const {data:role}=await admin.from("peyvand_user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(role?.role!=="owner") return reply({success:false,error:"فقط مالک اصلی سامانه اجازه تأیید دارد."},403);
  const {request_id}=await req.json();
  const {data:r,error:re}=await admin.from("peyvand_access_requests").select("*").eq("id",request_id).eq("status","pending").maybeSingle();
  if(re||!r||!r.auth_user_id) return reply({success:false,error:"درخواست در انتظار معتبر پیدا نشد."},404);
  const email="user-"+r.employee_number+"@peyvand.local";
  const {error:empErr}=await admin.from("peyvand_employees").insert({user_id:r.auth_user_id,full_name:r.full_name,employee_number:r.employee_number,email,phone:r.phone,is_active:true,branch_code:r.branch_code,marketing_account_number:r.marketing_account_number});
  if(empErr) return reply({success:false,error:"ثبت اطلاعات همکار ناموفق بود: "+empErr.message},400);
  const {error:roleErr}=await admin.from("peyvand_user_roles").insert({user_id:r.auth_user_id,role:"user"});
  if(roleErr){await admin.from("peyvand_employees").delete().eq("user_id",r.auth_user_id);return reply({success:false,error:"ثبت نقش کاربری ناموفق بود: "+roleErr.message},400);}
  const {error:updateErr}=await admin.from("peyvand_access_requests").update({status:"approved",reviewed_at:new Date().toISOString(),reviewed_by:user.id}).eq("id",request_id).eq("status","pending");
  if(updateErr){await admin.from("peyvand_user_roles").delete().eq("user_id",r.auth_user_id);await admin.from("peyvand_employees").delete().eq("user_id",r.auth_user_id);return reply({success:false,error:"به‌روزرسانی وضعیت درخواست ناموفق بود: "+updateErr.message},400);}
  return reply({success:true,message:"حساب فعال شد."});
 }catch(e){return reply({success:false,error:e.message||"خطای سرور"},500);}
});