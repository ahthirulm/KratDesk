import {round,schedule,today} from './pos-rules';
export type LoanTerms={installments:number;frequency:string;first_due:string};
export function revisedSchedule(amount:number,paid:number,terms:LoanTerms,date=today()){
 const remaining=round(amount-paid);
 if(remaining<=0)throw new Error('Closed loans cannot be rescheduled');
 if(!['Monthly','Every 2 weeks','Weekly'].includes(terms.frequency)||terms.first_due<date)throw new Error('Choose a valid frequency and a due date from today');
 const plan=schedule(remaining,terms.installments,terms.frequency,terms.first_due);
 if(!plan.length||plan.some(r=>r.amount<=0))throw new Error('Choose a valid installment count for this balance');
 return [...(paid>0?[{installment_no:0,due_date:date,amount:paid}]:[]),...plan];
}