import {expect,it} from 'vitest';
import {billingPrice,billingLine} from '@/lib/pos-rules';
it('prices one shop pound as exactly eight grams',()=>expect(billingPrice(8,320000,'Pound (8g)')).toBe(320000));
it('prices fractional pound weights without rounding the converted gram rate',()=>expect(billingPrice(41.350,320000.01,'Pound (8g)')).toBe(1654000.05));
it('preserves per gram pricing when selected',()=>expect(billingPrice(3.120,40000,'Gram')).toBe(124800));
it('saves the chosen unit and automatic piece total',()=>expect(billingLine('piece',3.120,312000,'Pound (8g)')).toEqual({id:'piece',rate_used:39000,unit_price:312000,price_unit:'Pound (8g)',final_price:121680}));