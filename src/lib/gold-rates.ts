export type GoldQuote={sourceDate:string;prices:Record<'22K'|'24K',number>};
export function colomboDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function parseGoldQuote(input:unknown,now=new Date()):GoldQuote{
 const p=input as any;
 if(!p||p.success!==true||p.currency!=='LKR'||p.unit?.name!=='pawn'||p.unit?.weight_grams!==8)throw new Error('Invalid currency or unit from provider');
 const date=p.source_date;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>colomboDate(now))throw new Error('Invalid publication date from provider');
 for(const purity of ['22K','24K'])if(typeof p.prices?.[purity]!=='number'||!Number.isFinite(p.prices[purity])||p.prices[purity]<=0||p.prices[purity]>1e12)throw new Error('Invalid '+purity+' price from provider');
 return {sourceDate:date,prices:{'22K':p.prices['22K'],'24K':p.prices['24K']}};
}
