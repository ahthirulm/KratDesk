import {round} from './pos-rules';

export type ExpenseDetails={amount:number;category:string;description:string;reference:string;date:string;staff_id:string;expense_month:string};

export function validateCash(kind:string,amount:number,description:string,availableMainCash:number){
 if(kind!=='Expense')throw new Error('Top-ups are not available; record shop receipts in main cash instead');
 if(!Number.isFinite(amount)||amount<=0||!description.trim())throw new Error('Enter a positive amount and description');
 if(!Number.isFinite(availableMainCash)||round(amount)>round(availableMainCash))throw new Error('Expense exceeds available main cash');
}

export function validateExpenseRequirements(requiresStaff:boolean,requiresMonth:boolean,staffId:string,expenseMonth:string){
 if(requiresStaff&&!staffId)throw new Error('Choose a staff member');
 if(requiresMonth&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(expenseMonth))throw new Error('Choose a valid expense month');
}

export function validateExpenseEdit(previousAmount:number,details:ExpenseDetails,availableMainCash:number,requiresStaff=false,requiresMonth=false){
 if(!Number.isFinite(previousAmount)||previousAmount<=0)throw new Error('The original expense is invalid');
 if(!Number.isFinite(details.amount)||details.amount<=0||!details.description.trim()||!details.category.trim())throw new Error('Enter a positive amount, category and description');
 if(!details.date)throw new Error('Choose an expense date');
 validateExpenseRequirements(requiresStaff,requiresMonth,details.staff_id,details.expense_month);
 const additionalCash=round(details.amount-previousAmount);
 if(!Number.isFinite(availableMainCash)||additionalCash>round(availableMainCash))throw new Error('Expense increase exceeds available main cash');
}
