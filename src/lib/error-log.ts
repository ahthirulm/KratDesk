import {supabase} from '@/integrations/supabase/client';
// Sends browser errors to the owner-only error log; throttled so a loop cannot flood it.
let sent=0;const seen=new Set<string>();
export async function logAppError(message:string,detail='',source='browser'){
 try{const key=message.slice(0,200);if(seen.has(key)||sent>=20)return;seen.add(key);sent++;
  const {data}=await supabase.auth.getSession();if(!data.session)return;
  await supabase.from('app_errors').insert({message:message.slice(0,1000),detail:detail.slice(0,8000),source,url:location.pathname.slice(0,1000),user_agent:navigator.userAgent.slice(0,500)});
 }catch{/* never let logging break the app */}
}
export function installErrorLogging(){
 const onErr=(e:ErrorEvent)=>void logAppError(e.message||'Script error',e.error?.stack||`${e.filename}:${e.lineno}`);
 const onRej=(e:PromiseRejectionEvent)=>{const r=e.reason;void logAppError(r instanceof Error?r.message:String(r),r instanceof Error?r.stack||'':'','promise')};
 window.addEventListener('error',onErr);window.addEventListener('unhandledrejection',onRej);
 return()=>{window.removeEventListener('error',onErr);window.removeEventListener('unhandledrejection',onRej)};
}
