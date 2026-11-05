// Supabase Edge Function: register-peyvand-request
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({success:false,error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,service,{auth:{persistSession:false}});
 try{
  const b=await req.json();
  const full_name=String(b.full_name||"").trim(), employee_number=String(b.employee_number||"").trim();
  let phone=String(b.phone||"").replace(/[\s()-]/g,"");
  const branch_code=String(b.branch_code||"").trim(), marketing_account_number=String(b.marketing_account_number||"").trim(), password=String(b.password||"");
  if(!full_name||!employee_number||!phone||!branch_code||!marketing_account_number||password.length<8) return reply({success:false,error:"همه اطلاعات الزامی است و رمز باید حداقل ۸ نویسه باشد."},400);
  if(phone.startsWith("09")&&phone.length===11) phone="+98"+phone.slice(1);
  else if(phone.startsWith("989")&&phone.length===12) phone="+"+phone;
  if(!/^\+[0-9]{8,15}$/.test(phone)) return reply({success:false,error:"شماره همراه معتبر نیست."},400);
  const {data:dup}=await admin.from("peyvand_access_requests").select("id").eq("employee_number",employee_number).in("status",["pending","approved"]).limit(1);
  if(dup?.length) return reply({success:false,error:"برای این شماره پرسنلی قبلاً ثبت‌نام یا درخواست ثبت شده است."},409);
  const email="user-"+employee_number+"@peyvand.local";
  const {data:userData,error:userError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name,employee_number,phone,registration_status:"pending"}});
  if(userError) return reply({success:false,error:userError.message},400);
  const {error:insertError}=await admin.from("peyvand_access_requests").insert({full_name,employee_number,phone,branch_code,marketing_account_number,status:"pending",auth_user_id:userData.user.id});
  if(insertError){await admin.auth.admin.deleteUser(userData.user.id);return reply({success:false,error:insertError.code==="23505"?"این شماره پرسنلی قبلاً درخواست داده است.":insertError.message},400);}
  return reply({success:true,message:"درخواست ثبت شد و منتظر تأیید مالک است."});
 }catch(e){return reply({success:false,error:e.message||"خطای سرور"},500);}
});