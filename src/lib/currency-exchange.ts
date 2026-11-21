export type FxCurrency={id:string;code:string;name:string;active:boolean};
export type FxAccount={branch_id:string;currency:string;balance:number;cost_lkr:number};
export type FxKind='Buy'|'Sell';
export type FxEntryKind=FxKind|'Funding'|'Withdrawal';
export type FxInput={branch_id:string;currency:string;kind:FxKind;amount:number;rate:number;counterparty:string;reference:string;note:string};
export type FxEntry=Omit<FxInput,'kind'>&{kind:FxEntryKind;id:string;date:string;created_at:string;lkr_total:number;cost_lkr:number;profit_lkr:number};
function units(value:number,decimals:number){
 if(!Number.isFinite(value)||value<0||value>1e12)throw new Error('Enter a valid amount and rate');
 const fixed=value.toFixed(decimals);
 if(Math.abs(Number(fixed)-value)>1e-9)throw new Error(`Use at most ${decimals} decimal places`);
 return BigInt(fixed.replace('.',''));
}
const roundedDivide=(n:bigint,d:bigint)=>(n+d/2n)/d;
export function exchangeTotal(amount:number,rate:number){return Number(roundedDivide(units(amount,2)*units(rate,6),1000000n))/100;}
export function fxApply(accounts:FxAccount[],input:FxInput){
 const {branch_id:branch,currency,kind,amount,rate}=input;
 if(!['Buy','Sell'].includes(kind)||amount<=0||rate<=0)throw new Error('Enter a positive amount and rate');
 if(currency==='LKR')throw new Error('Choose a foreign currency');
 const total=exchangeTotal(amount,rate);if(total<=0)throw new Error('Total must be at least 0.01');
 const rows=accounts.map(a=>({...a}));
 function get(code:string){let row=rows.find(a=>a.branch_id===branch&&a.currency===code);if(!row){row={branch_id:branch,currency:code,balance:0,cost_lkr:0};rows.push(row)}return row;}
 const cash=get('LKR'),holding=get(currency);let cost=0,profit=0;
 const cents=(n:number)=>units(n,2);
 const plus=(a:number,b:number)=>Number(cents(a)+cents(b))/100;
 const minus=(a:number,b:number)=>Number(cents(a)-cents(b))/100;
 const allocated=()=>amount===holding.balance?holding.cost_lkr:Number(roundedDivide(cents(holding.cost_lkr)*cents(amount),cents(holding.balance)))/100;
 if(kind==='Buy'){if(cash.balance<total)throw new Error('Insufficient shared branch cash');cash.balance=minus(cash.balance,total);holding.balance=plus(holding.balance,amount);holding.cost_lkr=plus(holding.cost_lkr,total);cost=total;}
 else {if(holding.balance<amount)throw new Error('Insufficient foreign currency balance');cost=allocated();holding.balance=minus(holding.balance,amount);holding.cost_lkr=minus(holding.cost_lkr,cost);cash.balance=plus(cash.balance,total);profit=minus(total,cost)}
 return {accounts:rows,lkr_total:total,cost_lkr:cost,profit_lkr:profit};
}
export function validateCurrency(currencies:FxCurrency[],entries:FxEntry[],next:FxCurrency|null,id?:string){
 const old=currencies.find(c=>c.id===id);const used=!!old&&entries.some(e=>e.currency===old.code);
 if(!next){if(used)throw new Error('Currency has transaction history; deactivate it instead');return;}
 if(!/^[A-Z]{3}$/.test(next.code)||next.code==='LKR'||!next.name.trim())throw new Error('Enter a three-letter foreign currency code and name');
 if(currencies.some(c=>c.id!==id&&c.code===next.code))throw new Error('Currency code already exists');
 if(used&&old?.code!==next.code)throw new Error('Used currency codes cannot be changed');
}
export function fxReport(entries:FxEntry[],branch:string,from='',to=''){
 const selected=entries.filter(e=>e.branch_id===branch&&(!from||e.date>=from)&&(!to||e.date<=to));
 const sum=(kind:FxEntryKind,field:'lkr_total'|'profit_lkr')=>Number(selected.filter(e=>e.kind===kind).reduce((s,e)=>s+BigInt(Math.round(e[field]*100)),0n))/100;
 return {entries:selected,bought:sum('Buy','lkr_total'),sold:sum('Sell','lkr_total'),profit:sum('Sell','profit_lkr')};
}
export function makeFxDemo(day:string){
 const currencies:FxCurrency[]=[{id:'fx-usd',code:'USD',name:'US Dollar',active:true},{id:'fx-eur',code:'EUR',name:'Euro',active:true},{id:'fx-gbp',code:'GBP',name:'Pound Sterling',active:true}];
 let accounts:FxAccount[]=['B1','B2'].map(branch_id=>({branch_id,currency:'LKR',balance:500000,cost_lkr:0}));const entries:FxEntry[]=[];
 for(const branch of ['B1','B2'])for(const p of [{currency:'USD',kind:'Buy',amount:500,rate:300},{currency:'EUR',kind:'Buy',amount:200,rate:330},{currency:'USD',kind:'Sell',amount:100,rate:310}] as const){
  const input={...p,branch_id:branch,counterparty:'Sample customer',reference:'SAMPLE',note:'Sample exchange'};
  const result=fxApply(accounts,input);accounts=result.accounts;entries.push({...input,...result,id:`fx-${branch}-${entries.length}`,date:day,created_at:`${day}T06:00:00Z`});
 }
 return {currencies,accounts,entries};
}