import {expect,it} from 'vitest';
import {validateCash,validateExpenseEdit,validateExpenseRequirements,type ExpenseDetails} from '@/lib/petty-cash';

const details=(amount:number):ExpenseDetails=>({amount,category:'Salaries',description:'March salaries',reference:'PAY-01',date:'2026-11-17',staff_id:'',expense_month:''});

it('allows an expense within main cash without a petty-cash top-up',()=>{
 expect(()=>validateCash('Expense',3750,'Tea',5000)).not.toThrow();
});

it('prevents expenses exceeding main cash',()=>{
 expect(()=>validateCash('Expense',3750,'Tea',3749.50)).toThrow('exceeds available main cash');
});

it('rejects new top-ups',()=>{
 expect(()=>validateCash('Top-up',5000,'Fund',10000)).toThrow('Top-ups are not available');
});

it('rejects non-positive expenses',()=>{
 expect(()=>validateCash('Expense',0,'Tea',10000)).toThrow('positive');
});

it('allows an expense increase when main cash covers only the difference',()=>{
 expect(()=>validateExpenseEdit(1000,details(1500),500)).not.toThrow();
});

it('allows reducing an expense when main cash is zero',()=>{
 expect(()=>validateExpenseEdit(1000,details(400),0)).not.toThrow();
});

it('blocks an expense increase above available main cash',()=>{
 expect(()=>validateExpenseEdit(1000,details(1500),499.99)).toThrow('increase exceeds available main cash');
});

it('requires staff and month for categories configured like Salaries',()=>{
 expect(()=>validateExpenseRequirements(true,true,'','')).toThrow('staff member');
 expect(()=>validateExpenseRequirements(true,true,'staff-1','')).toThrow('expense month');
 expect(()=>validateExpenseRequirements(true,true,'staff-1','2026-11')).not.toThrow();
});

it('keeps staff and month optional for other categories',()=>{
 expect(()=>validateExpenseRequirements(false,false,'','')).not.toThrow();
});
