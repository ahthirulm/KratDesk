import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {today} from '@/lib/pos-rules';
export type Reminder={id:string;branch_id:string;title:string;note:string;remind_date:string;done_at:string|null};
export const reminderDue=(r:Pick<Reminder,'remind_date'|'done_at'>,date=today())=>!r.done_at&&r.remind_date<=date;
export function useReminders(){
  const {data,branch,can}=usePos();const client=useQueryClient();const demo=data.demo===true;const key=['reminders',demo?'sample':'live'];
  const allowed=can('Create bills')||can('Collect repayments');
  const q=useQuery({queryKey:key,enabled:allowed&&(demo||!!data.user),staleTime:demo?Infinity:30_000,queryFn:async():Promise<Reminder[]>=>{if(demo)return [];const {data:rows,error}=await supabase.from('reminders').select('id,branch_id,title,note,remind_date,done_at').order('remind_date');if(error)throw error;return rows||[]}});
  const list=(q.data||[]).filter(r=>r.branch_id===branch);
  const add=async(title:string,note:string,remind_date:string)=>{if(!title.trim())throw new Error('Enter what to be reminded about');if(!/^\d{4}-\d{2}-\d{2}$/.test(remind_date))throw new Error('Pick a reminder date');
    if(demo){client.setQueryData<Reminder[]>(key,p=>[...(p||[]),{id:crypto.randomUUID(),branch_id:branch,title:title.trim(),note,remind_date,done_at:null}]);return;}
    const {error}=await supabase.rpc('add_reminder',{p:{branch_id:branch,title,note,remind_date,request_id:crypto.randomUUID()}});if(error)throw error;await client.invalidateQueries({queryKey:key});};
  const complete=async(id:string)=>{if(demo){client.setQueryData<Reminder[]>(key,p=>(p||[]).map(r=>r.id===id?{...r,done_at:new Date().toISOString()}:r));return;}
    const {error}=await supabase.rpc('complete_reminder',{rid:id});if(error)throw error;await client.invalidateQueries({queryKey:key});};
  const update=async(id:string,title:string,note:string,remind_date:string)=>{if(!title.trim())throw new Error('Enter what to be reminded about');if(!/^\d{4}-\d{2}-\d{2}$/.test(remind_date))throw new Error('Pick a reminder date');
    if(demo){client.setQueryData<Reminder[]>(key,p=>(p||[]).map(r=>r.id===id?{...r,title:title.trim(),note,remind_date}:r));return;}
    const {error}=await supabase.rpc('update_reminder',{p:{id,title,note,remind_date}});if(error)throw error;await client.invalidateQueries({queryKey:key});};
  const remove=async(id:string)=>{if(demo){client.setQueryData<Reminder[]>(key,p=>(p||[]).filter(r=>r.id!==id));return;}
    const {error}=await supabase.rpc('delete_reminder',{rid:id});if(error)throw error;await client.invalidateQueries({queryKey:key});};
  return {update,remove,reminders:list,dueCount:allowed?list.filter(r=>reminderDue(r)).length:0,add,complete,allowed};
}
