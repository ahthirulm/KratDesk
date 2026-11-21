export const normalizeTag = (tag:string) => tag.trim().toLowerCase();
export function tagExists(items:{id:string;tag_id:string}[],tag:string,excludeId?:string){return items.some(item=>item.id!==excludeId&&normalizeTag(item.tag_id)===normalizeTag(tag));}
export function nextDemoSystemTag(items:{system_tag:string}[]){const max=items.reduce((n,item)=>Math.max(n,Number(item.system_tag.match(/^KD(\d{6,})$/)?.[1]||0)),0);return `KD${String(max+1).padStart(6,'0')}`;}
export function findStockItem<T extends {tag_id:string;system_tag:string}>(items:T[],value:string):T|undefined{const tag=normalizeTag(value);return items.find(item=>normalizeTag(item.system_tag)===tag)||items.find(item=>normalizeTag(item.tag_id)===tag);}
