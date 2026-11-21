import type {Store} from '@/components/pos/data';
import {round,today,allocate} from './pos-rules';
import {inReportPeriod} from './report-period';
import {effectiveLoanPaid} from './sale-lifecycle';
export type DashboardPeriod='today'|'month'|'year'|'all';
export function dashboardRange(period:DashboardPeriod,day=today()){
 if(period==='all')return {from:'',to:''};
 if(period==='month')return {from:day.slice(0,8)+'01',to:day};
 if(period==='year')return {from:day.slice(0,4)+'-01-01',to:day};
 return {from:day,to:day};
}
export function dashboardOverall(data:Store,from='',to=''){
 const sales=data.sales.filter(sale=>inReportPeriod(sale.date||'',from,to));
 const lines=data.lines.filter(line=>sales.some(sale=>sale.id===line.sale_id));
 const revenue=round(sales.reduce((sum,sale)=>sum+sale.final_total,0));
 const cost=data.costs.filter(row=>lines.some(line=>line.id===row.sale_item_id)).reduce((sum,row)=>sum+row.purchase_cost,0);
 const stock=data.items.filter(item=>item.status==='In Stock');
 return {sales:revenue,profit:round(revenue-cost),stockCount:stock.length,stockWeight:Number(stock.reduce((sum,item)=>sum+item.weight,0).toFixed(3))};
}
export function dashboardTotals(data:Store,day=today()){
 const sales=data.sales.filter(s=>s.date===day);const lines=data.lines.filter(l=>sales.some(s=>s.id===l.sale_id));
 const revenue=round(sales.reduce((sum,s)=>sum+s.final_total,0));const cost=data.costs.filter(c=>lines.some(l=>l.id===c.sale_item_id)).reduce((sum,c)=>sum+c.purchase_cost,0);
 const branchIds=[...new Set([...data.items,...data.sales,...data.loans].map(r=>r.branch_id))];
 const repayments=(data.grossPayments||data.payments).filter(p=>p.date===day&&branchIds.includes(p.branch_id)).reduce((sum,p)=>sum+p.amount,0);
 const balances=data.loans.map(l=>{const paid=effectiveLoanPaid(l,data.payments,data.reversals||[]);const rows=allocate(data.installments.filter(i=>i.loan_id===l.id),paid,day);return {...l,balance:round(l.amount-paid),overdue:round(rows.filter(r=>r.status==='Overdue').reduce((sum,r)=>sum+r.balance,0))}});
 const refunds=(data.reversals||[]).filter(r=>r.created_at.slice(0,10)===day).reduce((sum,r)=>sum+r.refund_amount,0);const cashSales=(data.grossSales||data.sales).filter(s=>s.date===day);
 return {sales,revenue,profit:round(revenue-cost),cashIn:round(cashSales.reduce((sum,s)=>sum+s.paid_now,0)+repayments-refunds),repayments,balances,stock:data.items.filter(i=>i.status==='In Stock'),outstanding:round(balances.reduce((sum,l)=>sum+l.balance,0)),overdue:round(balances.reduce((sum,l)=>sum+l.overdue,0))};
}
