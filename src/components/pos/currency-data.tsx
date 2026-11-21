import {createContext,useContext,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {today} from '@/lib/pos-rules';
import {fxApply,makeFxDemo,validateCurrency,type FxCurrency,type FxInput,type FxEntry,type FxAccount} from '@/lib/currency-exchange';
type FxState={currencies:FxCurrency[];entries:FxEntry[];accounts:FxAccount[]};
const Context=createContext<(FxState&{loading:boolean;error:string;saveCurrency:(next:FxCurrency|null,id?:string)=>Promise<void>;record:(p:FxInput)=>Promise<void>})|null>(null);
export function CurrencyProvider({children}:{children:ReactNode}){
 const {data}=usePos();const client=useQueryClient();const [sample,setSample]=useState(()=>makeFxDemo(today()));
 const q=useQuery({queryKey:['currency-exchange',data.user?.id],enabled:!!data.user&&!data.demo&&!data.securityBlocked,queryFn:async()=>{
  const [c,a,e]=await Promise.all([supabase.from('fx_currencies').select('*').order('code'),supabase.from('fx_accounts').select('*'),supabase.from('fx_entries').select('*').order('created_at',{ascending:false})]);
  for(const r of [c,a,e])if(r.error)throw r.error;
  return {currencies:c.data||[],accounts:a.data||[],entries:(e.data||[]) as FxEntry[]};
 }});
 const state:FxState=data.demo?sample:q.data||{currencies:[],accounts:[],entries:[]};
 const refresh=async()=>{await client.invalidateQueries()};
 async function saveCurrency(next:FxCurrency|null,id?:string){
  const normalized=next?{...next,code:next.code.trim().toUpperCase(),name:next.name.trim()}:null;
  validateCurrency(state.currencies,state.entries,normalized,id);
  if(data.demo){setSample(prev=>({...prev,currencies:normalized?[...prev.currencies.filter(c=>c.id!==id),normalized]:prev.currencies.filter(c=>c.id!==id)}));return;}
  const {error}=await supabase.rpc('manage_fx_currency',{p:normalized?{...normalized,id:id||null}:{id,action:'Remove'}});if(error)throw error;await refresh();
 }
 async function record(p:FxInput){
  if(p.currency!=='LKR'&&!state.currencies.some(c=>c.code===p.currency&&c.active))throw new Error('Choose an active currency');
  const result=fxApply(state.accounts,p);
  if(data.demo){setSample(prev=>{const result=fxApply(prev.accounts,p);return {...prev,accounts:result.accounts,entries:[{...p,lkr_total:result.lkr_total,cost_lkr:result.cost_lkr,profit_lkr:result.profit_lkr,id:crypto.randomUUID(),date:today(),created_at:new Date().toISOString()},...prev.entries]}});return;}
  const {error}=await supabase.rpc('record_fx_entry',{p:{...p,request_id:crypto.randomUUID()}});if(error)throw error;await refresh();
 }
 return <Context.Provider value={{...state,loading:!!data.user&&q.isPending,error:q.error?.message||'',saveCurrency,record}}>{children}</Context.Provider>;
}
export function useCurrency(){const c=useContext(Context);if(!c)throw new Error('Currency provider required');return c;}