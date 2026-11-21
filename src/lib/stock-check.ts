// Pure stock-count reconciliation: compares scanned tags with the branch's in-stock pieces.
export type CheckItem={id:string;tag_id:string;system_tag:string;name:string;weight:number;status:string};
export function stockCheck(items:CheckItem[],scans:string[]){
 const norm=(s:string)=>s.trim().toUpperCase();const inStock=items.filter(i=>i.status==='In Stock');
 const found=new Map<string,CheckItem>();const extra:string[]=[];const duplicates:string[]=[];
 for(const raw of scans){const code=norm(raw);if(!code)continue;const hit=inStock.find(i=>norm(i.tag_id)===code||norm(i.system_tag)===code);
  if(!hit){if(!extra.includes(code))extra.push(code);continue}
  if(found.has(hit.id))duplicates.push(code);else found.set(hit.id,hit)}
 return {found:[...found.values()],missing:inStock.filter(i=>!found.has(i.id)),extra,duplicates,expected:inStock.length};
}
