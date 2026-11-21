import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
async function admin(ctx:any){const {data,error}=await ctx.supabase.rpc('is_admin');if(error||!data)throw new Error('Admin access required');}
export const getGoldRates=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await admin(context);const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const db=supabaseAdmin as any;
 const [settings,history,fetched,profiles]=await Promise.all([db.from('kd_gold_settings').select('*').eq('id',1).single(),db.from('kd_rate_history').select('*').order('changed_at',{ascending:false}).limit(200),db.from('kd_gold_fetch_history').select('*').order('fetched_at',{ascending:false}).limit(100),db.from('profiles').select('id,display_name')]);
 if(settings.error||history.error||fetched.error)throw new Error('Rate history unavailable. Check the v2.2 migration.');
 return {settings:settings.data,history:history.data,fetched:fetched.data,profiles:profiles.data||[]} as any;
});
export const setGoldEnabled=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{enabled:boolean})=>{if(typeof data.enabled!=='boolean')throw new Error('Invalid setting');return data;}).handler(async({data,context})=>{
 await admin(context);const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {error}=await (supabaseAdmin as any).from('kd_gold_settings').update({enabled:data.enabled}).eq('id',1);if(error)throw new Error('Could not save rate setting');return {ok:true};
});
export const fetchGoldRates=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await admin(context);const {refreshGold}=await import('./gold-rates.server');return refreshGold();});
export const applyGoldRates=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await admin(context);const {error}=await (context.supabase as any).rpc('kd_apply_gold_rates');if(error)throw new Error(error.message);return {ok:true};});
