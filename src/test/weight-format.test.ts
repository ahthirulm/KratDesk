import {expect,it} from 'vitest';
import {formatWeight,priceAtBilling} from '@/lib/pos-rules';

it('omits .000 for whole grams',()=>expect(formatWeight(55)).toBe('55g'));
it('keeps all three decimals for fractional grams',()=>expect(formatWeight(41.350)).toBe('41.350g'));
it('does not round fractional grams to whole grams',()=>expect(formatWeight(55.999)).toBe('55.999g'));
it('retains single milligram precision',()=>expect(formatWeight(0.001)).toBe('0.001g'));
it('formats summed milligram weights without floating-point noise',()=>expect(formatWeight(0.1+0.2)).toBe('0.300g'));
it('leaves recorded weight and price calculations unchanged',()=>{const weight=41.350;formatWeight(weight);expect(weight).toBe(41.350);expect(priceAtBilling(weight,1000)).toBe(41350)});