// Today's stock value: in-stock weight × today's rate per gram for each metal; pieces without a rate are left out and reported.
export function stockValue(items:{metal_id:string;weight:number;status:string}[],rates:{id:string;rate:number}[]){
 const byMetal:Record<string,{weight:number;value:number}>={};let total=0,pricedWeight=0,unpricedWeight=0;
 for(const i of items){if(i.status!=='In Stock')continue;const r=rates.find(x=>x.id===i.metal_id)?.rate||0;const m=byMetal[i.metal_id]??={weight:0,value:0};m.weight+=i.weight;if(r>0){const val=Math.round(i.weight*r*100)/100;m.value+=val;total+=val;pricedWeight+=i.weight}else unpricedWeight+=i.weight}
 return {total:Math.round(total*100)/100,pricedWeight,unpricedWeight,byMetal};
}
