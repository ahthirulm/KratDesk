import {describe,expect,it} from 'vitest';
import {stockValue} from '@/lib/stock-value';
describe('stock value',()=>{
 it('multiplies today’s rate by in-stock weight',()=>{expect(stockValue([{metal_id:'g',weight:10,status:'In Stock'},{metal_id:'g',weight:5,status:'Sold'}],[{id:'g',rate:30000}]).total).toBe(300000)});
 it('leaves out metals with no rate today',()=>{const r=stockValue([{metal_id:'s',weight:4,status:'In Stock'}],[]);expect(r.total).toBe(0);expect(r.unpricedWeight).toBe(4)});
});
