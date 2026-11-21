import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Landmark,ArrowDownToLine,ArrowUpFromLine} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Field,Select,Stat,Empty,CredentialConfirm} from './shared';
import {usePos} from './data';
import {money,today} from '@/lib/pos-rules';
import {OWNER_CASH_KINDS,capitalSummary,mainCashEffect,validateOwnerCash,type OwnerCashKind} from '@/lib/owner-cash';
import {reportMatches,reportPeriod,type ReportRows} from '@/lib/report-export';
import {FilteredCsvButton,useReportExport} from './report-export';

export function useOwnerCash(branch:string){
 const {data}=usePos();
 const allowed=useQuery({queryKey:['owner-cash-allowed',branch],enabled:!data.demo&&!!data.user,queryFn:async()=>{const {data:ok}=await supabase.rpc('owner_cash_allowed',{target_branch:branch});return ok===true}});
 const moves=useQuery({queryKey:['capital-movements',branch],enabled:allowed.data===true,queryFn:async()=>{const {data:rows,error}=await supabase.from('capital_movements').select('*').eq('branch_id',branch).order('created_at',{ascending:false});if(error)throw error;return rows}});
 return {allowed:allowed.data===true,rows:moves.data||[],loading:!data.demo&&!!data.user&&(allowed.isPending||(allowed.data===true&&moves.isPending)),error:moves.error instanceof Error?moves.error.message:undefined};
}
const inRange=(d:string,from:string,to:string)=>(!from||d>=from)&&(!to||d<=to);
// Report view: owner money and bank moves in a date range, never mixed into profit.
export function OwnerCashReport({initialFrom=today(),initialTo=today()}:{initialFrom?:string|undefined;initialTo?:string|undefined}){
 const {branch}=usePos();const {rows,loading,error}=useOwnerCash(branch);const [from,setFrom]=useState(initialFrom||'');const [to,setTo]=useState(initialTo||'');const [kind,setKind]=useState('All');const [search,setSearch]=useState('');
 const list=rows.filter(r=>inRange(r.date,from,to)&&(kind==='All'||r.kind===kind)&&reportMatches(search,r.kind,r.note,r.date,r.created_by));const s=capitalSummary(list),all=capitalSummary(rows);
 const exportRows:ReportRows=[['Date','Type','Note','Amount','Main cash effect','Bank effect','Recorded by'],...list.map(r=>[r.date,r.kind,r.note||'',r.amount,mainCashEffect(r.kind as OwnerCashKind,Number(r.amount)),r.kind==='Bank deposit'?r.amount:r.kind==='Bank withdrawal'?-r.amount:0,r.created_by])];
 useReportExport({id:'owner-cash',title:'Owner cash & bank',filename:'owner-cash-bank',filters:`${reportPeriod(from,to)}; Type: ${kind}; Search: ${search||'None'}`,rows:exportRows,loading,error});
 return <><div className="report-export-row"><span>{list.length} filtered movements</span><FilteredCsvButton filename="owner-cash-bank" rows={exportRows} count={list.length}/></div><div className="report-filter-grid report-filters"><Field label="From"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="To"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field><Field label="Movement type"><Select value={kind} onChange={setKind} options={['All',...OWNER_CASH_KINDS]}/></Field></div><div className="search-box mb-4"><Input aria-label="Search owner cash and bank" placeholder="Search type, note or date" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <p className="dashboard-overall-note">Owner cash and bank moves change main cash only. They are not counted as sales, expenses or profit.</p>
 <div className="stats-grid"><Stat label="Invested" value={money(s.invested)}/><Stat label="Taken out" value={money(s.withdrawn)}/><Stat label="Net owner movement" value={money(s.net)}/><Stat label="Net to bank" value={money(s.bank)}/><Stat label="Bank balance (all time)" value={money(all.bank)}/></div>
 {list.length?<div className="table-scroll"><table><thead><tr><th>DATE</th><th>TYPE</th><th>NOTE</th><th>AMOUNT</th><th>MAIN CASH EFFECT</th><th>BANK EFFECT</th></tr></thead><tbody>{list.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.kind}</td><td>{r.note||'—'}</td><td>{money(r.amount)}</td><td>{money(mainCashEffect(r.kind as OwnerCashKind,Number(r.amount)))}</td><td>{money(r.kind==='Bank deposit'?r.amount:r.kind==='Bank withdrawal'?-r.amount:0)}</td></tr>)}</tbody></table></div>:<Empty title="Nothing matches these filters" description="Change the dates, type or search to see more."/>}</>;
}
// Owner investment, drawings and bank moves change main cash but never profit.
export function OwnerCash({branch,mainCash,filters,periodNote,children}:{branch:string;mainCash:number;filters?:React.ReactNode;periodNote?:React.ReactNode;children?:React.ReactNode}){
 const {data}=usePos();const qc=useQueryClient();
 const {allowed,rows}=useOwnerCash(branch);
 const [kind,setKind]=useState<OwnerCashKind|null>(null);const [amount,setAmount]=useState('');const [note,setNote]=useState('');const [date,setDate]=useState(today());const [confirm,setConfirm]=useState(false);
 if(!allowed)return filters||children?<section className="dashboard-section account-card"><div className="branch-account-toolbar">{filters}</div>{periodNote}<div className="stats-grid account-balance-stats">{children}</div></section>:null;
 const s=capitalSummary(rows);
 const open=(k:OwnerCashKind)=>{setKind(k);setAmount('');setNote('');setDate(today())};
 const next=()=>{try{validateOwnerCash(kind!,Number(amount),mainCash,s.bank);setConfirm(true)}catch(e){toast.error(e instanceof Error?e.message:'Check the details')}};
 const save=async()=>{const {error}=await supabase.rpc('record_capital_movement',{p:{branch_id:branch,kind,amount:Number(amount),note,date}});if(error)throw new Error(error.message);setConfirm(false);setKind(null);await qc.invalidateQueries();toast.success(`${kind} recorded`)};
 return <section className="dashboard-section account-card owner-cash-card"><div className="dashboard-heading"><div><h2>Owner cash</h2><span>Investment, profit taken and bank moves · profit is not affected</span></div></div>
  <div className="branch-account-toolbar"><div className="flex flex-wrap gap-2"><Button onClick={()=>open('Owner cash in')}><ArrowDownToLine/>Cash in</Button><Button variant="outline" onClick={()=>open('Owner cash out')}><ArrowUpFromLine/>Cash out</Button><Button variant="outline" onClick={()=>open('Bank deposit')}><Landmark/>Bank deposit</Button><Button variant="outline" onClick={()=>open('Bank withdrawal')}><Landmark/>Bank withdrawal</Button></div>
  {filters}</div>
  {periodNote}
  <div className="stats-grid account-balance-stats">{children}<Stat label="Total invested" value={money(s.invested)}/><Stat label="Total taken out" value={money(s.withdrawn)}/><Stat label="Net owner balance" value={money(s.net)}/><Stat label="Bank balance" value={money(s.bank)}/></div>
  <details className="account-movements"><summary>Owner movement history <span>({rows.length})</span></summary>
  <div className="table-scroll"><table><thead><tr><th>DATE</th><th>TYPE</th><th>NOTE</th><th>AMOUNT</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.date}</td><td><span className="badge neutral">{r.kind}</span></td><td>{r.note||'—'}</td><td>{money(r.amount)}</td></tr>)}</tbody></table></div>
  {!rows.length&&<Empty title="No owner cash movements yet" description="Use Cash in for investment and Cash out for profit taken."/>}
  {kind&&!confirm&&<Dialog open onOpenChange={()=>setKind(null)}><DialogContent><DialogHeader><DialogTitle>{kind}</DialogTitle></DialogHeader>
   <Field label="Type"><Select value={kind} onChange={v=>setKind(v as OwnerCashKind)} label="Type" options={OWNER_CASH_KINDS.map(k=>({value:k,label:k}))}/></Field>
   <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
   <Field label="Date"><Input type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></Field>
   <Field label="Note"><Input maxLength={300} value={note} placeholder="e.g. November profit taken" onChange={e=>setNote(e.target.value)}/></Field>
   <p className="text-sm text-muted-foreground">Main cash now: {money(mainCash)}{kind==='Bank withdrawal'?` · Bank: ${money(s.bank)}`:''}</p>
   <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setKind(null)}>Cancel</Button><Button disabled={!amount} onClick={next}>Continue</Button></div></DialogContent></Dialog>}
  {kind&&confirm&&<CredentialConfirm title={`Confirm ${kind.toLowerCase()}`} detail={<p>{kind} · <b>{money(Number(amount))}</b>. This entry can't be edited later; correct mistakes with an opposite entry.</p>} email={data.user?.email||''} onConfirm={save} onClose={()=>setConfirm(false)}/>}
 </details></section>;
}
