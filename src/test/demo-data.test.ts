import {describe,it,expect} from 'vitest';
import {createDemoStore} from '@/lib/demo-data';
import {dashboardTotals} from '@/lib/dashboard';
import {round,allocate} from '@/lib/pos-rules';
describe('isolated sample records',()=>{
const day='2026-11-17';const data=createDemoStore('B1',day);
it('shows samples without granting a signed-in role',()=>{expect(data.demo).toBe(true);expect(data.user).toBeNull();expect(data.admin).toBe(false)});
it('populates every record category',()=>{for(const rows of [data.items,data.sales,data.lines,data.customers,data.rates,data.loans,data.installments,data.payments,data.staff,data.roles])expect(rows.length).toBeGreaterThan(0)});
it('separates branch stock and sales while sharing customers and rates',()=>{const b=createDemoStore('B2',day);expect(b.items.some(i=>data.items.some(a=>a.tag_id===i.tag_id))).toBe(false);expect(b.sales.some(s=>data.sales.some(a=>a.id===s.id))).toBe(false);expect(b.customers).toEqual(data.customers);expect(b.rates).toEqual(data.rates)});
it('preserves three decimal weights',()=>{expect(data.items[0]?.weight).toBe(16.250);expect(data.items[1]?.weight).toBe(4.125)});
it('links sold pieces to invoice and historical pricing',()=>{for(const line of data.lines){const sale=data.sales.find(s=>s.id===line.sale_id);expect(sale?.invoice_no).toBe(data.items.find(i=>i.id===line.item_id)?.sold_invoice);expect(sale?.final_total).toBe(line.final_price);expect(line.calculated_price).toBe(round(line.weight*line.rate_used))}});
it('keeps loans interest free and never overpaid',()=>{for(const loan of data.loans){expect(round(data.installments.filter(i=>i.loan_id===loan.id).reduce((s,i)=>s+i.amount,0))).toBe(loan.amount);expect(data.payments.filter(p=>p.loan_id===loan.id).reduce((s,p)=>s+p.amount,0)).toBeLessThanOrEqual(loan.amount)}});
it('includes due, overdue and paid schedules',()=>{const statuses=new Set(data.loans.flatMap(l=>allocate(data.installments.filter(i=>i.loan_id===l.id),data.payments.filter(p=>p.loan_id===l.id).reduce((s,p)=>s+p.amount,0),day).map(i=>i.status)));expect(statuses.has('Due')).toBe(true);expect(statuses.has('Overdue')).toBe(true);expect(statuses.has('Paid')).toBe(true)});
it('offers 21K Gold as a selectable metal with a daily rate',()=>{expect(data.metals.map(m=>m.name)).toContain('21K Gold');expect(data.rates.filter(r=>data.metals.find(m=>m.id===r.metal_id&&m.name==='21K Gold')).length).toBeGreaterThan(0)});
it('counts daily sales and receipts without unpaid loan balances',()=>{const totals=dashboardTotals(data,day);expect(totals.sales.length).toBe(2);expect(totals.revenue).toBe(822438.75);expect(totals.cashIn).toBe(round(data.sales.filter(s=>s.date===day).reduce((sum,s)=>sum+s.paid_now,0)+data.payments.filter(p=>p.date===day).reduce((sum,p)=>sum+p.amount,0)));expect(totals.cashIn).toBeLessThan(totals.revenue);expect(totals.stock.length).toBe(12)});
});
