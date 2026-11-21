import type {PricingUnit} from './pos-rules';
export type GoldAccount={branch_id:string;purity:number;weight:number;cost_lkr:number};
export type GoldInput={branch_id:string;purity:number;kind:'Buy'|'Sell';weight:number;pricing_unit:PricingUnit;unit_price:number;customer_name:string;customer_phone:string;method:string;reference:string;note:string};
export type GoldEntry=GoldInput&{id:string;date:string;created_at:string;total_lkr:number;cost_lkr:number;profit_lkr:number};
export type GoldTransferInput={from_branch:string;to_branch:string;purity:number;weight:number;note:string};
export type GoldMovement=GoldTransferInput&{id:string;cost_lkr:number;created_at:string};
function scaled(value:number,decimals:number){
 if(!Number.isFinite(value)||value<0||value>1e9||Math.abs(Number(value.toFixed(decimals))-value)>1e-9)throw new Error(`Enter a valid value with at most ${decimals} decimals`);
 return BigInt(value.toFixed(decimals).replace('.',''));
}
const divide=(n:bigint,d:bigint)=>(n+d/2n)/d;
export function goldTotal(weight:number,price:number,unit:PricingUnit){return Number(divide(scaled(weight,3)*scaled(price,2),unit==='Pound (8g)'?8000n:1000n))/100;}
export function applyGold(accounts:GoldAccount[],p:GoldInput){
 if(!['Buy','Sell'].includes(p.kind)||!Number.isInteger(p.purity)||p.purity<1||p.purity>24||p.weight<=0||p.unit_price<=0||!['Gram','Pound (8g)'].includes(p.pricing_unit)||!['Cash','Bank Transfer','Card'].includes(p.method))throw new Error('Enter valid purity, weight, price and payment method');
 const total=goldTotal(p.weight,p.unit_price,p.pricing_unit);if(total<=0)throw new Error('Total must be at least 0.01');
 const rows=accounts.map(a=>({...a}));let account=rows.find(a=>a.branch_id===p.branch_id&&a.purity===p.purity);
 if(!account){account={branch_id:p.branch_id,purity:p.purity,weight:0,cost_lkr:0};rows.push(account);}
 const grams=scaled(p.weight,3),held=scaled(account.weight,3),cost=scaled(account.cost_lkr,2);let used=0n;
 if(p.kind==='Buy'){account.weight=Number(held+grams)/1000;account.cost_lkr=Number(cost+scaled(total,2))/100;used=scaled(total,2);}
 else{if(grams>held)throw new Error('Sale exceeds available old-gold weight for this purity');used=grams===held?cost:divide(cost*grams,held);account.weight=Number(held-grams)/1000;account.cost_lkr=Number(cost-used)/100;}
 return {accounts:rows,total_lkr:total,cost_lkr:Number(used)/100,profit_lkr:p.kind==='Sell'?Number(scaled(total,2)-used)/100:0};
}
export function goldReport(entries:GoldEntry[],branch:string,from='',to='',purity='All'){
 const rows=entries.filter(e=>e.branch_id===branch&&(!from||e.date>=from)&&(!to||e.date<=to)&&(purity==='All'||e.purity===Number(purity)));
 const sum=(kind:string,key:'total_lkr'|'profit_lkr')=>Number(rows.filter(e=>e.kind===kind).reduce((s,e)=>s+BigInt(Math.round(e[key]*100)),0n))/100;
 return {entries:rows,bought:sum('Buy','total_lkr'),sold:sum('Sell','total_lkr'),profit:sum('Sell','profit_lkr')};
}
export function transferGold(accounts:GoldAccount[],p:GoldTransferInput){
 if(!p.from_branch||!p.to_branch||p.from_branch===p.to_branch)throw new Error('Choose another branch');
 if(!Number.isInteger(p.purity)||p.purity<1||p.purity>24||p.weight<=0)throw new Error('Enter a valid purity and positive weight');
 const grams=scaled(p.weight,3);const rows=accounts.map(a=>({...a}));const source=rows.find(a=>a.branch_id===p.from_branch&&a.purity===p.purity);
 if(!source||grams>scaled(source.weight,3))throw new Error('Transfer exceeds available old-gold weight for this purity');
 const held=scaled(source.weight,3),cost=scaled(source.cost_lkr,2);const moved=grams===held?cost:divide(cost*grams,held);
 let destination=rows.find(a=>a.branch_id===p.to_branch&&a.purity===p.purity);
 if(!destination){destination={branch_id:p.to_branch,purity:p.purity,weight:0,cost_lkr:0};rows.push(destination);}
 source.weight=Number(held-grams)/1000;source.cost_lkr=Number(cost-moved)/100;
 destination.weight=Number(scaled(destination.weight,3)+grams)/1000;destination.cost_lkr=Number(scaled(destination.cost_lkr,2)+moved)/100;
 return {accounts:rows,cost_lkr:Number(moved)/100};
}
export function goldDemo(day:string){
 let accounts:GoldAccount[]=[];const entries:GoldEntry[]=[];
 for(const branch of ['B1','B2'])for(const trade of [{kind:'Buy',purity:22,weight:40,unit_price:160000},{kind:'Buy',purity:21,weight:24,unit_price:152000},{kind:'Buy',purity:24,weight:16,unit_price:180000},{kind:'Sell',purity:22,weight:8,unit_price:168000}] as const){
  const p:GoldInput={...trade,branch_id:branch,pricing_unit:'Pound (8g)',customer_name:'Sample customer',customer_phone:'',method:'Cash',reference:'SAMPLE',note:''};const result=applyGold(accounts,p);accounts=result.accounts;entries.unshift({...p,total_lkr:result.total_lkr,cost_lkr:result.cost_lkr,profit_lkr:result.profit_lkr,id:`gold-${branch}-${entries.length}`,date:day,created_at:day+'T06:00:00Z'});
 }
 return {accounts,entries};
}