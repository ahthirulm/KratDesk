import {displayReference} from '@/lib/display-reference';
import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Wallet,ArrowRightLeft,Scale,HandCoins,ArrowUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePos} from './data';
import {useCurrency} from './currency-data';
import {useOldGold} from './old-gold-data';
import {PageTitle,Stat,Empty} from './shared';
import {OwnerCash} from './owner-cash';
import {dashboardOverall,dashboardRange,type DashboardPeriod} from '@/lib/dashboard';
import {overallProfitSummary} from '@/lib/profit-summary';
import {formatWeight,money,round} from '@/lib/pos-rules';
import {inReportPeriod} from '@/lib/report-period';

// One screen, one branch: main cash is summarized together while each ledger stays separate.
type Move={date:string;area:string;detail:string;cashIn:number;cashOut:number};
export function BranchAccount(){
 const {data,rawData,saleReversals,branch,branches,can,pettyEntries}=usePos();
 const currency=useCurrency();const oldGold=useOldGold();const [period,setPeriod]=useState<DashboardPeriod>('month');const range=dashboardRange(period);
 const name=branches.find(b=>b.id===branch)?.name||branch;const fx=currency.accounts.filter(a=>a.branch_id===branch);const cash=round(fx.find(a=>a.currency==='LKR')?.balance||0);const held=fx.filter(a=>a.currency!=='LKR');const heldValue=round(held.reduce((sum,a)=>sum+a.cost_lkr,0));
 const gold=oldGold.accounts.filter(a=>a.branch_id===branch);const goldWeight=Number(gold.reduce((sum,a)=>sum+a.weight,0).toFixed(3));const goldCost=round(gold.reduce((sum,a)=>sum+a.cost_lkr,0));
 const overall=dashboardOverall(data,range.from,range.to);const profit=overallProfitSummary(overall.profit,currency.entries,oldGold.entries,branch,range.from,range.to);
 const showCurrency=can('View currency reports')||can('Manage currency exchange');const showGold=can('View costs and profit');const showPetty=can('Manage expenses');
 const moves:Move[]=[
  ...rawData.sales.filter(e=>e.branch_id===branch&&inReportPeriod(e.date||'',range.from,range.to)).map(e=>({date:e.date||'',area:'Jewellery',detail:`${displayReference(e.invoice_no)} · ${e.payment_method==='Mixed'?'Split':e.payment_method}`,cashIn:e.paid_now,cashOut:0})),
  ...rawData.payments.filter(e=>e.branch_id===branch&&inReportPeriod(e.date||'',range.from,range.to)).map(e=>({date:e.date||'',area:'Loan repayment',detail:`${displayReference(e.receipt_no||'Receipt')} · ${e.method}`,cashIn:e.amount,cashOut:0})),
  ...saleReversals.filter(e=>e.branch_id===branch&&inReportPeriod(e.created_at.slice(0,10),range.from,range.to)).map(e=>({date:e.created_at.slice(0,10),area:e.kind==='Void'?'Bill void':'Sales return',detail:`${displayReference(rawData.sales.find(s=>s.id===e.sale_id)?.invoice_no||'Invoice')} · ${e.reason}`,cashIn:0,cashOut:e.refund_amount})),
  ...(showCurrency?currency.entries:[]).filter(e=>e.branch_id===branch&&inReportPeriod(e.date,range.from,range.to)).map(e=>({date:e.date,area:'Currency',detail:`${e.kind} ${e.currency} ${e.amount}${e.reference?` · ${e.reference}`:''}`,cashIn:e.kind==='Sell'||(e.currency==='LKR'&&e.kind==='Funding')?e.lkr_total:0,cashOut:e.kind==='Buy'||(e.currency==='LKR'&&e.kind==='Withdrawal')?e.lkr_total:0})),
  ...(showGold?oldGold.entries:[]).filter(e=>e.branch_id===branch&&inReportPeriod(e.date,range.from,range.to)).map(e=>({date:e.date,area:'Old gold',detail:`${e.kind} ${e.purity}K ${formatWeight(e.weight)}${e.customer_name?` · ${e.customer_name}`:''}`,cashIn:e.kind==='Sell'?e.total_lkr:0,cashOut:e.kind==='Buy'?e.total_lkr:0})),
  ...(showPetty?pettyEntries:[]).filter(e=>e.branch_id===branch&&inReportPeriod(e.date,range.from,range.to)).map(e=>({date:e.date,area:'Expenses',detail:`${e.kind} · ${e.category||'General'}${e.description?` — ${e.description}`:''}`,cashIn:e.kind==='Top-up'?e.amount:0,cashOut:e.kind==='Expense'?e.amount:0})),
 ].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
 const cashIn=round(moves.reduce((sum,m)=>sum+m.cashIn,0));const cashOut=round(moves.reduce((sum,m)=>sum+m.cashOut,0));const busy=(showCurrency&&currency.loading)||(showGold&&oldGold.loading);const failed=(showCurrency&&currency.error)||(showGold&&oldGold.error);const periodLabel=period==='all'?'All time':period==='today'?'Today':period==='month'?'This month':'This year';
 return <div className="branch-account-page"><PageTitle title="Branch account" subtitle={`${name} · all money in one view`} actions={<Button asChild variant="outline"><Link to="/reports" search={{report:'jewellery' as const}}>Reports<ArrowUpRight/></Link></Button>}/>
  <OwnerCash branch={branch} mainCash={cash} filters={<div className="dashboard-periods" role="group" aria-label="Account period">{([['today','Today'],['month','This month'],['year','This year'],['all','All time']] as const).map(([id,label])=><Button key={id} variant={period===id?'default':'outline'} aria-pressed={period===id} onClick={()=>setPeriod(id)}>{label}</Button>)}</div>} periodNote={<p className="dashboard-overall-note">{periodLabel} · balances shown are current{busy?' · loading…':failed?' · some figures unavailable':''}</p>}>
   <Stat label="Main cash" value={money(cash)} icon={<Wallet/>}/><Stat label="Currency held" value={held.length?`${held.length} ${held.length===1?'currency':'currencies'} · ${money(heldValue)}`:'None'} icon={<ArrowRightLeft/>}/><Stat label="Old gold held" value={goldWeight?`${formatWeight(goldWeight)} · ${money(goldCost)}`:'None'} icon={<Scale/>}/><Stat label="Combined profit" value={can('View costs and profit')?money(profit.total):'Restricted'} icon={<ArrowUpRight/>}/>
  </OwnerCash>
  <section className="dashboard-section account-card"><div className="dashboard-heading"><div><h2>Cash movements</h2><span>{name} · jewellery, currency, old gold and expenses</span></div><span className="badge neutral">{moves.length} records</span></div><div className="stats-grid cash-movement-stats"><Stat label="Cash in" value={money(cashIn)}/><Stat label="Cash out" value={money(cashOut)}/><Stat label="Net cash movement" value={money(round(cashIn-cashOut))}/></div>
   <details className="account-movements"><summary>Transaction details <span>({moves.length})</span></summary><div className="table-scroll"><table><thead><tr><th>DATE</th><th>AREA</th><th>DETAIL</th><th>CASH IN</th><th>CASH OUT</th></tr></thead><tbody>{moves.map((m,n)=><tr key={`${m.date}-${n}`}><td>{m.date}</td><td><span className="badge neutral">{m.area}</span></td><td>{m.detail}</td><td>{m.cashIn?money(m.cashIn):'—'}</td><td>{m.cashOut?money(m.cashOut):'—'}</td></tr>)}</tbody></table></div>{!moves.length&&<Empty title="No money movements in this period" description="Complete sales, collect repayments, trade currency or old gold, and record refunds or expenses to see them here."/>}</details>
  </section>
  <div className="account-holdings-grid">
   {showCurrency&&<section className="dashboard-section account-card"><div className="dashboard-heading"><div><h2>Currency holdings</h2><span>{name} · original holding cost</span></div><Button asChild variant="ghost" size="icon" title="Open currency exchange"><Link to="/currency-exchange"><ArrowUpRight/></Link></Button></div><div className="table-scroll"><table><thead><tr><th>CURRENCY</th><th>AMOUNT HELD</th><th>COST</th></tr></thead><tbody>{held.map(a=><tr key={a.currency}><td><b>{a.currency}</b></td><td>{a.balance}</td><td>{money(a.cost_lkr)}</td></tr>)}</tbody></table></div>{!held.length&&<Empty title="No foreign currency held" description="Buy foreign currency to see its balance and original cost here."/>}</section>}
   {showGold&&<section className="dashboard-section account-card"><div className="dashboard-heading"><div><h2>Old gold holdings</h2><span>{name} · pooled by purity</span></div><Button asChild variant="ghost" size="icon" title="Open old gold"><Link to="/old-gold"><ArrowUpRight/></Link></Button></div><div className="table-scroll"><table><thead><tr><th>PURITY</th><th>WEIGHT</th><th>COST</th></tr></thead><tbody>{gold.map(a=><tr key={a.purity}><td><b>{a.purity}K</b></td><td>{formatWeight(a.weight)}</td><td>{money(a.cost_lkr)}</td></tr>)}</tbody></table></div>{!gold.length&&<Empty title="No old gold held" description="Buy old gold to see its weight and original cost here."/>}</section>}
  </div>
  <section className="dashboard-section account-card"><div className="dashboard-heading"><div><h2>Profit in this period</h2><span>{periodLabel} · owner cash and bank movements are excluded</span></div></div><div className="stats-grid account-profit-stats"><Stat label="Jewellery profit" value={can('View costs and profit')?money(profit.jewellery):'Restricted'}/><Stat label="Currency exchange profit" value={showCurrency?money(profit.currency):'Restricted'}/><Stat label="Old-gold profit" value={showGold?money(profit.oldGold):'Restricted'}/><Stat label="Total profit" value={can('View costs and profit')?money(profit.total):'Restricted'} icon={<HandCoins/>}/></div></section>
 </div>;
}
