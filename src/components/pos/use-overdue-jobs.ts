import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {today} from '@/lib/pos-rules';
// Open jobs past their estimated delivery date in the current branch; key shares the 'repair-jobs' prefix so job actions refresh it.
export function useOverdueJobs(){
 const {data,branch,can}=usePos();const on=!data.demo&&!!data.user&&can('Create bills');
 const q=useQuery({queryKey:['repair-jobs','overdue',branch],enabled:on,staleTime:60000,queryFn:async()=>{const {count,error}=await supabase.from('repair_jobs').select('id',{count:'exact',head:true}).eq('branch_id',branch).in('status',['Received','At repairer','Ready']).lt('est_delivery',today());if(error)throw error;return count||0}});
 return on?q.data||0:0;
}
