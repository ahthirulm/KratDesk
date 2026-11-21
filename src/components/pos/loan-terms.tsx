import {useState} from 'react';
import {toast} from 'sonner';
import {Save} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Field,Select} from './shared';
import {usePos} from './data';
import {money,today} from '@/lib/pos-rules';
import {revisedSchedule} from '@/lib/loan-terms';
export function LoanTermsEditor({id,amount,paid,frequency,count,first,onClose}:{id:string;amount:number;paid:number;frequency:string;count:number;first:string;onClose:()=>void}){
 const {adjustLoanTerms}=usePos();const [terms,setTerms]=useState({installments:count||6,frequency,first_due:first<today()?today():first});const [busy,setBusy]=useState(false);let error='';let plan:ReturnType<typeof revisedSchedule>=[];try{plan=revisedSchedule(amount,paid,terms).filter(r=>r.installment_no>0)}catch(e){error=e instanceof Error?e.message:'Check terms'}
 return <Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Adjust installment terms</DialogTitle></DialogHeader><p>Remaining balance: <b>{money(amount-paid)}</b></p><Field label="New installment count"><Input type="number" min="1" max="120" value={terms.installments} onChange={e=>setTerms({...terms,installments:Number(e.target.value)})}/></Field><Field label="Repayment frequency"><Select label="Repayment frequency" value={terms.frequency} onChange={frequency=>setTerms({...terms,frequency})} options={['Monthly','Every 2 weeks','Weekly']}/></Field><Field label="New first due date"><Input type="date" min={today()} value={terms.first_due} onChange={e=>setTerms({...terms,first_due:e.target.value})}/></Field><div className="table-scroll max-h-60"><table><thead><tr><th>No.</th><th>Due date</th><th>Amount</th></tr></thead><tbody>{plan.map(r=><tr key={r.installment_no}><td>{r.installment_no}</td><td>{r.due_date}</td><td>{money(r.amount)}</td></tr>)}</tbody></table></div>{error&&<p role="alert">{error}</p>}<Button disabled={busy||!!error} onClick={async()=>{setBusy(true);try{await adjustLoanTerms(id,terms);toast.success('Loan terms updated');onClose()}catch(e){toast.error(e instanceof Error?e.message:'Could not update terms')}finally{setBusy(false)}}}><Save/>{busy?'Saving…':'Save revised terms'}</Button></DialogContent></Dialog>;
}