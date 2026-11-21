export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let moneyCurrency = 'LKR';
export const setMoneyCurrency = (label: string) => { moneyCurrency = label.trim() || 'LKR'; };
export const money = (n: number) => n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, '');
// Stock is recorded to milligram precision; only suppress an all-zero fraction.
export const formatWeight = (grams: number) => `${grams.toFixed(3).replace(/\.000$/, '')}g`;
export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// A typed amount stays readable: no stuck leading zero, and an emptied field stays empty.
export const cleanNumberText = (raw: string) => { const t = raw.trim(); return t === '' || t === '.' || t === '-' ? '' : t.replace(/^0+(?=\d)/, ''); };
export function distribute(total: number, values: number[]) { const sum = values.reduce((a,b)=>a+b,0); if (!sum || total<0) return values; let used=0; return values.map((v,i)=> { const price=i===values.length-1?round(total-used):round(total*v/sum); used=round(used+price); return price; }); }
export function schedule(amount: number, count: number, frequency: string, first: string) { if(count<1 || count>120 || !Number.isInteger(count) || !first || amount<=0) return []; const base=Math.floor(round(amount)*100/count)/100; const [y=0,m=1,d=1]=first.split('-').map(Number);if(!y||m<1||m>12||d<1||d>31)return []; return Array.from({length:count},(_,i)=> { let date:Date; if(frequency==='Monthly') { const last=new Date(Date.UTC(y,m+i,0)).getUTCDate(); date=new Date(Date.UTC(y,m-1+i,Math.min(d,last))); } else date=new Date(Date.UTC(y,m-1,d+i*(frequency==='Weekly'?7:14))); return { installment_no:i+1,due_date:date.toISOString().slice(0,10),amount:i===count-1?round(amount-base*(count-1)):base }; }); }
export function allocate<T extends {amount:number,due_date:string}>(rows:T[],paid:number,date=today()) { let remaining=paid; return rows.map(r=> {const applied=Math.min(remaining,r.amount); remaining=round(Math.max(0,remaining-r.amount));const balance=round(r.amount-applied);return {...r,paid:applied,balance,status:balance===0?'Paid':r.due_date<date?'Overdue':applied>0?'Partial':'Due'};}); }
export const nextMonth = () => schedule(1,2,'Monthly',today())[1]?.due_date || today();

export function priceAtBilling(weight:number,pricePerGram:number){return Number.isFinite(weight)&&weight>0&&Number.isFinite(pricePerGram)&&pricePerGram>0?round(weight*pricePerGram):0;}
export type PricingUnit='Gram'|'Pound (8g)';
export function billingPrice(weight:number,unitPrice:number,unit:PricingUnit){return priceAtBilling(weight,unitPrice/(unit==='Pound (8g)'?8:1));}
export function billingLine(id:string,weight:number,unitPrice:number,unit:PricingUnit){return {id,rate_used:round(unitPrice/(unit==='Pound (8g)'?8:1)),unit_price:unitPrice,price_unit:unit,final_price:billingPrice(weight,unitPrice,unit)};}
