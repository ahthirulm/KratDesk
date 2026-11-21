import {describe,expect,it} from 'vitest';
import {stockCheck} from '@/lib/stock-check';
const items=[{id:'1',tag_id:'R-1',system_tag:'KD000001',name:'Ring',weight:2,status:'In Stock'},{id:'2',tag_id:'C-2',system_tag:'KD000002',name:'Chain',weight:8,status:'In Stock'},{id:'3',tag_id:'B-3',system_tag:'KD000003',name:'Bangle',weight:5,status:'Sold'}];
describe('stock check',()=>{
 it('matches shop or system tags, case-insensitively',()=>{const r=stockCheck(items,['r-1','KD000002']);expect(r.found.length).toBe(2);expect(r.missing.length).toBe(0)});
 it('lists unscanned in-stock pieces as missing',()=>{expect(stockCheck(items,['R-1']).missing.map(i=>i.id)).toEqual(['2'])});
 it('treats sold or unknown tags as extra',()=>{expect(stockCheck(items,['B-3','XYZ']).extra).toEqual(['B-3','XYZ'])});
 it('counts a piece once when scanned twice',()=>{const r=stockCheck(items,['R-1','KD000001']);expect(r.found.length).toBe(1);expect(r.duplicates).toEqual(['KD000001'])});
});
