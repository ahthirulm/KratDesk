export type RepairLike={status:string;charge:number;collected:number;repair_cost:number;cost_paid:number;est_delivery:string};
const r2=(n:number)=>Math.round(n*100)/100;
export const OPEN_REPAIR=['Received','At repairer','Ready'];
export const repairBalance=(j:RepairLike)=>r2(j.charge-j.collected);
export const repairerDue=(j:RepairLike)=>r2(j.repair_cost-j.cost_paid);
export const repairProfit=(j:RepairLike)=>j.status==='Cancelled'?0:r2(j.charge-j.repair_cost);
// Overdue = still open and the promised delivery date has passed (Colombo shop day).
export const repairOverdue=(j:RepairLike,today:string)=>OPEN_REPAIR.includes(j.status)&&j.est_delivery<today;
export const repairDueToday=(j:RepairLike,today:string)=>OPEN_REPAIR.includes(j.status)&&j.est_delivery===today;
export function repairSummary(jobs:RepairLike[]){
 const done=jobs.filter(j=>j.status==='Delivered');
 return {delivered:done.length,charged:r2(done.reduce((s,j)=>s+j.charge,0)),cost:r2(done.reduce((s,j)=>s+j.repair_cost,0)),profit:r2(done.reduce((s,j)=>s+repairProfit(j),0))};
}
