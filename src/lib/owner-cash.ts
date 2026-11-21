export const OWNER_CASH_KINDS=['Owner cash in','Owner cash out','Bank deposit','Bank withdrawal'] as const;
export type OwnerCashKind=typeof OWNER_CASH_KINDS[number];
export type CapitalMove={kind:string;amount:number};
// Effect on branch main cash: investment and bank withdrawals add; drawings and deposits remove.
export const mainCashEffect=(kind:OwnerCashKind,amount:number)=>kind==='Owner cash in'||kind==='Bank withdrawal'?amount:-amount;
export function capitalSummary(moves:CapitalMove[]){
 const sum=(k:string)=>Math.round(moves.filter(m=>m.kind===k).reduce((s,m)=>s+Number(m.amount),0)*100)/100;
 const invested=sum('Owner cash in'),withdrawn=sum('Owner cash out');
 return {invested,withdrawn,net:Math.round((invested-withdrawn)*100)/100,bank:Math.round((sum('Bank deposit')-sum('Bank withdrawal'))*100)/100};
}
export function validateOwnerCash(kind:OwnerCashKind,amount:number,mainCash:number,bank:number){
 if(!OWNER_CASH_KINDS.includes(kind))throw new Error('Choose a valid movement type');
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)/100!==amount)throw new Error('Enter a valid amount');
 if(mainCashEffect(kind,amount)<0&&amount>mainCash)throw new Error('Main cash is not enough for this');
 if(kind==='Bank withdrawal'&&amount>bank)throw new Error('Bank balance is not enough for this withdrawal');
}
