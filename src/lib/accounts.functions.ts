import {createServerFn} from '@tanstack/react-start';
import {getRequest} from '@tanstack/react-start/server';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {normalizeUsername,internalLoginEmail,validatePassword} from './security-rules';

async function backend(){
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 return supabaseAdmin as any;
}
async function admin(context:any){
 const {data,error}=await context.supabase.rpc('is_admin');
 if(error||!data)throw new Error('Admin access required');
}
function emailAddress(value:string){
 const email=value.trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address');
 return email;
}
async function limit(db:any,key:string,max:number,seconds:number){
 const {createHash}=await import('node:crypto');
 const {data,error}=await db.rpc('kd_take_limit',{p_key:createHash('sha256').update(key).digest('hex'),p_limit:max,p_seconds:seconds});
 if(error||!data)throw new Error('Please wait before trying again');
}
async function sendAccountLink(db:any,userId:string,email:string){
 const {data:config,error}=await db.from('backup_schedule').select('api_key,from_email,from_name').eq('id',1).single();
 if(error||!process.env['RESEND_API_KEY'])throw new Error('Configure the email service key and sender in Administration → Scheduled email backup first');
 const {data:user,error:userError}=await db.auth.admin.getUserById(userId);
 if(userError||!user?.user?.email)throw new Error('User account unavailable');
 const generated=await db.auth.admin.generateLink({type:'recovery',email:user.user.email});
 if(generated.error)throw new Error('Could not generate account link');
 const {createHash}=await import('node:crypto');
 const digest=createHash('sha256').update(generated.data.properties.hashed_token).digest('hex');
 const {error:linkError}=await db.from('kd_account_links').upsert({user_id:userId,email,token_digest:digest,expires_at:new Date(Date.now()+3600000).toISOString(),used:false});
 if(linkError)throw new Error('Could not save account link');
 const origin=process.env['KD_APP_ORIGIN']?new URL(process.env['KD_APP_ORIGIN']).origin:new URL(getRequest().url).origin;
 const link=origin+'/reset-password#token='+encodeURIComponent(generated.data.properties.hashed_token);
 const {resendFetch}=await import('./scheduled-backup.server');
 await resendFetch(config.api_key,'/emails',{method:'POST',body:JSON.stringify({
  from:`${config.from_name||'KaratDesk'} <${config.from_email||'accounts@notify.scopule.com'}>`,to:[email],subject:'Set your KaratDesk password',
  text:`Username: ${user.user.email.replace(/@app\.local$/i, '')}\nSign-in email: ${email}\n\nOpen the following link to verify your email and set your password. This link can be used once and expires in one hour.\n\n${link}\n\nIf you did not request this email, you can ignore it.`,
 })});
}
export const loginWithPassword=createServerFn({method:'POST'})
 .inputValidator((data:{identity:string;password:string})=>data)
 .handler(async({data})=>{
  const db=await backend();
  const identity=data.identity.trim().toLowerCase();
  const ip=getRequest().headers.get('x-karatdesk-client-ip')||'unknown';
  const limitKey='login:'+ip+':'+identity;
  await limit(db,limitKey,10,300);
  let loginEmail='';
  try{
   if(identity.includes('@')){
    const email=emailAddress(identity);
    const {data:contact}=await db.from('kd_account_contacts').select('user_id').eq('email',email).not('verified_at','is',null).maybeSingle();
    if(!contact)throw new Error('Invalid login');
    const {data:user}=await db.auth.admin.getUserById(contact.user_id);
    if(!user?.user?.email)throw new Error('Invalid login');
    loginEmail=user.user.email;
   }else{
    loginEmail=internalLoginEmail(normalizeUsername(identity));
   }
   if(!data.password||data.password.length>72)throw new Error('Invalid login');
   const {createClient}=await import('@supabase/supabase-js');
   const client=createClient(process.env['SUPABASE_URL']!,process.env['SUPABASE_PUBLISHABLE_KEY']!,{auth:{persistSession:false,autoRefreshToken:false}});
   const signed=await client.auth.signInWithPassword({email:loginEmail,password:data.password});
   if(signed.error||!signed.data.session)throw new Error('Invalid login');
   const {createHash}=await import('node:crypto');
   await db.from('kd_request_limits').delete().eq('key',createHash('sha256').update(limitKey).digest('hex'));
   return {session:signed.data.session};
  }catch{
   throw new Error('Invalid email/username or password');
  }
 });
export const accountDirectory=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await admin(context);const db=await backend();const {data,error}=await db.from('kd_account_contacts').select('user_id,email,verified_at,invited_at');if(error)throw error;return data as {user_id:string;email:string;verified_at:string|null;invited_at:string}[];
});
export const inviteAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((data:{name:string;username:string;email:string;roleName:string;branchIds:string[];active:boolean;administrator:boolean})=>data)
 .handler(async({data,context})=>{
  await admin(context);const db=await backend();await limit(db,'invite:'+context.userId,10,3600);
  const email=emailAddress(data.email);const username=normalizeUsername(data.username);
  if(!data.name.trim()||data.name.length>100)throw new Error('Enter a user name');
  if(data.administrator){const {data:owner}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!owner)throw new Error('Owner access required');}
  const {data:role,error:roleError}=await context.supabase.from('staff_roles').select('id').eq('name',data.roleName).single();
  if(roleError||!role)throw new Error('Select a valid role');
  const {randomBytes}=await import('node:crypto');
  const created=await db.auth.admin.createUser({email:internalLoginEmail(username),password:randomBytes(40).toString('base64url'),email_confirm:true,user_metadata:{display_name:data.name.trim(),username}});
  if(created.error)throw new Error('Could not create user. Check the username is unique.');
  const id=created.data.user.id;
  try{
   const saved=await context.supabase.rpc('save_staff_access',{p:{user_id:id,role_id:role.id,display_name:data.name.trim(),branch_ids:data.branchIds,active:data.active}});if(saved.error)throw saved.error;
   if(data.administrator){const result=await context.supabase.rpc('set_administrator',{p_user_id:id,p_enabled:true});if(result.error)throw result.error;}
   const contact=await db.from('kd_account_contacts').insert({user_id:id,email});if(contact.error)throw new Error('This email is already assigned');
  }catch(error){await db.from('kd_account_contacts').delete().eq('user_id',id);await db.auth.admin.deleteUser(id);throw error;}
  try{await sendAccountLink(db,id,email);}catch{return {id,sent:false};}
  return {id,sent:true};
 });
export const sendExistingInvitation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((data:{userId:string;email:string})=>data).handler(async({data,context})=>{
  await admin(context);const db=await backend();await limit(db,'invite:'+context.userId,10,3600);
  const {data:target}=await db.from('user_roles').select('role').eq('user_id',data.userId).single();
  const {data:owner}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if(!target||(['admin','administrator'].includes(target.role)&&!owner))throw new Error('Owner access required');
  const email=emailAddress(data.email);
  const {data:old}=await db.from('kd_account_contacts').select('email,verified_at').eq('user_id',data.userId).maybeSingle();
  const changingVerified=!!old?.verified_at&&old.email.toLowerCase()!==email;
  if(changingVerified&&!owner)throw new Error('Only the owner can change a verified email');
  const {error}=await db.from('kd_account_contacts').upsert({user_id:data.userId,email,verified_at:changingVerified?null:old?.verified_at||null,invited_at:new Date().toISOString()});if(error)throw new Error('Email is already assigned');
  await sendAccountLink(db,data.userId,email);return {ok:true};
 });
export const requestPasswordReset=createServerFn({method:'POST'}).inputValidator((data:{email:string})=>data).handler(async({data})=>{
 const db=await backend();const email=emailAddress(data.email);const ip=getRequest().headers.get('x-karatdesk-client-ip')||'unknown';
 await limit(db,'recovery-ip:'+ip,10,3600);
 try{
  await limit(db,'recovery-email:'+email,3,3600);
  const {data:contact}=await db.from('kd_account_contacts').select('user_id').eq('email',email).not('verified_at','is',null).maybeSingle();
  if(contact)await sendAccountLink(db,contact.user_id,email);
 }catch{/* Generic response avoids revealing email registration or delivery state. */}
 return {message:'If this email is registered and verified, a password-reset link will arrive shortly.'};
});
export const finishAccountLink=createServerFn({method:'POST'}).inputValidator((data:{token:string;password:string;code?:string})=>data).handler(async({data})=>{
 const password=validatePassword(data.password);if(!/^[a-zA-Z0-9_-]{32,256}$/.test(data.token))throw new Error('Invalid or expired link');
 const db=await backend();await limit(db,'finish:'+ (getRequest().headers.get('x-karatdesk-client-ip')||'unknown'),20,300);
 const {createHash}=await import('node:crypto');
 const digest=createHash('sha256').update(data.token).digest('hex');
 const {data:link,error:linkError}=await db.from('kd_account_links').update({used:true}).eq('token_digest',digest).eq('used',false).gt('expires_at',new Date().toISOString()).select('user_id,email').maybeSingle();
 if(linkError||!link)throw new Error('This link has expired or was already used. Request another link.');
 const {createClient}=await import('@supabase/supabase-js');
 const client=createClient(process.env['SUPABASE_URL']!,process.env['SUPABASE_PUBLISHABLE_KEY']!,{auth:{persistSession:false,autoRefreshToken:false}});
 const verified=await client.auth.verifyOtp({token_hash:data.token,type:'recovery'});
 if(verified.error||!verified.data.user||!verified.data.session)throw new Error('This link has expired or was already used. Request another link.');
 const id=verified.data.user.id;
 const {data:contact}=await db.from('kd_account_contacts').select('email').eq('user_id',id).single();
 if(!contact||id!==link.user_id||contact.email!==link.email){await client.auth.signOut();throw new Error('No invitation exists for this account');}
 const factors=await client.auth.mfa.listFactors();
 const factor=factors.data?.totp.find(f=>f.status==='verified');
 if(factors.error){await client.auth.signOut();throw new Error('Could not verify account security. Request a new link.');}
 if(factor){
  if(!/^\d{6}$/.test(data.code||'')){await client.auth.signOut();throw new Error('Authenticator code required. Request a new link and enter your current code.');}
  const code=data.code;
  if(!code){await client.auth.signOut();throw new Error('Authenticator code required');}
  const challenge=await client.auth.mfa.challengeAndVerify({factorId:factor.id,code});
  if(challenge.error){await client.auth.signOut();throw new Error('Invalid authenticator code. Request a new link.');}
 }
 const update=await client.auth.updateUser({password});
 if(update.error){await client.auth.signOut();throw new Error('Could not set password. Request a new link.');}
 const {error}=await db.from('kd_account_contacts').update({verified_at:new Date().toISOString()}).eq('user_id',id);
 await client.auth.signOut({scope:'global'});
 if(error)throw new Error('Password updated. Contact the administrator to verify email status.');
 await db.from('audit_events').insert({actor_id:id,actor_name:verified.data.user.user_metadata?.['display_name']||'User',category:'Security',action:'Email password set',description:'Email verified and password set using a single-use account link',record_id:id});
 return {ok:true};
});
