import {describe,it,expect} from 'vitest';
import {repairBalance,repairerDue,repairProfit,repairOverdue,repairSummary} from '@/lib/repairs';
const job=(o={})=>({status:'Ready',charge:5000,collected:1000,repair_cost:3500,cost_paid:0,est_delivery:'2026-11-20',...o});
describe('repair jobs',()=>{
 it('profit is customer charge minus repairer cost',()=>{expect(repairProfit(job())).toBe(1500)});
 it('a 1500 charge with a 500 technician payment profits 1000',()=>{expect(repairProfit(job({status:'Delivered',charge:1500,collected:1500,repair_cost:500,cost_paid:500}))).toBe(1000)});
 it('cancelled jobs make no profit',()=>{expect(repairProfit(job({status:'Cancelled'}))).toBe(0)});
 it('balance and repairer due',()=>{expect(repairBalance(job())).toBe(4000);expect(repairerDue(job({cost_paid:500}))).toBe(3000)});
 it('overdue only when open and past the delivery date',()=>{expect(repairOverdue(job(),'2026-11-21')).toBe(true);expect(repairOverdue(job(),'2026-11-20')).toBe(false);expect(repairOverdue(job({status:'Delivered'}),'2026-11-30')).toBe(false)});
 it('summary counts delivered jobs only',()=>{expect(repairSummary([job({status:'Delivered'}),job()])).toEqual({delivered:1,charged:5000,cost:3500,profit:1500})});
});
