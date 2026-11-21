import {fxReport,type FxEntry} from './currency-exchange';
import {goldReport,type GoldEntry} from './old-gold';

export function profitSummary(jewelleryProfit:number,entries:FxEntry[],branch:string,from:string,to:string){
 const exchange=fxReport(entries,branch,from,to);
 const cents=(value:number)=>BigInt(Math.round(value*100));
 return {jewellery:jewelleryProfit,currency:exchange.profit,total:Number(cents(jewelleryProfit)+cents(exchange.profit))/100};
}

export function overallProfitSummary(jewelleryProfit:number,entries:FxEntry[],goldEntries:GoldEntry[],branch:string,from='',to=''){
 const summary=profitSummary(jewelleryProfit,entries,branch,from,to);
 const oldGold=goldReport(goldEntries,branch,from,to).profit;
 const cents=(value:number)=>BigInt(Math.round(value*100));
 return {...summary,oldGold,total:Number(cents(summary.total)+cents(oldGold))/100};
}