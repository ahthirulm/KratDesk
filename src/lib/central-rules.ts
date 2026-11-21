import type {Store} from '@/components/pos/data';
export function scopeStore(store:Store,branch:string):Store {
 const sales=store.sales.filter(s=>s.branch_id===branch);
 const lines=store.lines.filter(l=>sales.some(s=>s.id===l.sale_id));
 const loans=store.loans.filter(l=>l.branch_id===branch);
 return {...store,items:store.items.filter(i=>i.branch_id===branch),sales,lines,costs:store.costs.filter(c=>lines.some(l=>l.id===c.sale_item_id)),loans,installments:store.installments.filter(i=>loans.some(l=>l.id===i.loan_id)),payments:store.payments.filter(p=>loans.some(l=>l.id===p.loan_id)||p.branch_id===branch)};
}
export function validateTransfer(item:{status:string;branch_id:string}|undefined,from:string,to:string,activeBranches:string[]){
 if(!item||item.status!=='In Stock')throw new Error('Only in-stock pieces can be transferred');
 if(item.branch_id!==from)throw new Error('Piece has already moved');
 if(from===to||!activeBranches.includes(to))throw new Error('Choose another active branch');
}
export function permissionAllowed(admin:boolean,active:boolean,permissions:string[],assigned:string[],permission:string,branch?:string){return admin||(active&&permissions.includes(permission)&&(!branch||assigned.includes(branch)));}