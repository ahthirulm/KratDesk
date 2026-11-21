import {createContext,useContext,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {today} from '@/lib/pos-rules';
import {applyGold,goldDemo,transferGold,type GoldAccount,type GoldEntry,type GoldInput,type GoldMovement,type GoldTransferInput} from '@/lib/old-gold';
const Context=createContext<{accounts:GoldAccount[];entries:GoldEntry[];movements:GoldMovement[];transfer:(p:GoldTransferInput)=>Promise<void>;loading:boolean;error:string;record:(p:GoldInput)=>Promise<void>}|null>(null);
export function OldGoldProvider({children}:{children:ReactNode}){
 const {data,branches}=usePos();const client=useQueryClient();const [sample,setSample]=useState(()=>({...goldDemo(today()),movements:[] as GoldMovement[]}));
 const query=useQuery({queryKey:['old-gold',data.user?.id],enabled:!!data.user&&!data.demo&&!data.securityBlocked,queryFn:async()=>{const [a,e,m]=await Promise.all([supabase.from('old_gold_accounts').select('*'),supabase.from('old_gold_entries').select('*').order('created_at',{ascending:false}),supabase.from('old_gold_movements').select('*').order('created_at',{ascending:false})]);if(a.error)throw a.error;if(e.error)throw e.error;if(m.error)throw m.error;return {accounts:a.data||[],entries:(e.data||[]) as GoldEntry[],movements:m.data||[]};}});
 const state=data.demo?sample:query.data||{accounts:[],entries:[],movements:[]};
 async function record(p:GoldInput){
  applyGold(state.accounts,p);
  if(data.demo){setSample(previous=>{const result=applyGold(previous.accounts,p);return {...previous,accounts:result.accounts,entries:[{...p,total_lkr:result.total_lkr,cost_lkr:result.cost_lkr,profit_lkr:result.profit_lkr,id:crypto.randomUUID(),date:today(),created_at:new Date().toISOString()},...previous.entries]}});return;}
  const {error}=await supabase.rpc('record_old_gold',{p:{...p,request_id:crypto.randomUUID()}});if(error)throw error;await client.invalidateQueries();
 }
 async function transfer(p:GoldTransferInput){
  if(!branches.some(b=>b.id===p.to_branch&&b.active))throw new Error('Choose another active branch');
  transferGold(state.accounts,p);
  if(data.demo){setSample(previous=>{const result=transferGold(previous.accounts,p);return {...previous,accounts:result.accounts,movements:[{...p,cost_lkr:result.cost_lkr,id:crypto.randomUUID(),created_at:new Date().toISOString()},...previous.movements]}});return;}
  const {error}=await supabase.rpc('transfer_old_gold',{p:{...p,request_id:crypto.randomUUID()}});if(error)throw error;await client.invalidateQueries();
 }
 return <Context.Provider value={{...state,loading:!!data.user&&query.isPending,error:query.error?.message||'',record,transfer}}>{children}</Context.Provider>;
}
export function useOldGold(){const context=useContext(Context);if(!context)throw new Error('Old-gold provider required');return context;}