import {expect,it} from 'vitest';
import {overallProfitSummary,profitSummary} from '@/lib/profit-summary';
import {makeFxDemo} from '@/lib/currency-exchange';
import {goldDemo} from '@/lib/old-gold';

it('adds realised exchange profit to jewellery profit while preserving separate results',()=>{
 const {entries}=makeFxDemo('2026-11-17');
 expect(profitSummary(2500,entries,'B1','2026-11-17','2026-11-17')).toEqual({jewellery:2500,currency:1000,total:3500});
});
it('excludes other branches and dates from combined profit',()=>{
 const {entries}=makeFxDemo('2026-11-17');
 expect(profitSummary(2500,entries,'B1','2026-11-18','2026-11-18').total).toBe(2500);
 expect(profitSummary(2500,entries,'B3','2026-11-17','2026-11-17').currency).toBe(0);
});
it('does not recognise purchases or funding as profit and retains realised losses',()=>{
 const {entries}=makeFxDemo('2026-11-17');
 const adjusted=entries.map(e=>({...e,profit_lkr:e.kind==='Sell'?-100.25:5000}));
 expect(profitSummary(200.1,adjusted,'B1','2026-11-17','2026-11-17')).toEqual({jewellery:200.1,currency:-100.25,total:99.85});
});
it('combines all-time jewellery, currency and old-gold realised profit without merging their separate results',()=>{
 const {entries}=makeFxDemo('2026-11-17');
 const gold=goldDemo('2026-11-17');
 expect(overallProfitSummary(166177.55,entries,gold.entries,'B1')).toEqual({jewellery:166177.55,currency:1000,oldGold:8000,total:175177.55});
});