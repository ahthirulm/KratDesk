import {expect,it} from 'vitest';
import {priceAtBilling} from '@/lib/pos-rules';
it('prices a piece using its weight multiplied by billing-entered price per gram',()=>expect(priceAtBilling(4.125,28500)).toBe(117562.50));
it('updates the calculated price when the billing price changes',()=>expect(priceAtBilling(4.125,30000)).toBe(123750));
it('adjusts the piece total solely through its gram price',()=>{expect(priceAtBilling(3.120,40000)).toBe(124800);expect(priceAtBilling(3.120,39000)).toBe(121680)});
it('rounds billing prices to two decimal places',()=>expect(priceAtBilling(3.125,123.45)).toBe(385.78));
it('cannot price a piece with a missing or invalid price',()=>{expect(priceAtBilling(4.125,0)).toBe(0);expect(priceAtBilling(4.125,NaN)).toBe(0);expect(priceAtBilling(4.125,-1)).toBe(0)});
