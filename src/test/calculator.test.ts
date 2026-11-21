import {describe,it,expect} from 'vitest';
import {evaluate} from '@/lib/calculator';
describe('calculator',()=>{
  it('respects precedence',()=>expect(evaluate('2+3×4')).toBe(14));
  it('handles decimals exactly',()=>expect(evaluate('0.1+0.2')).toBe(0.3));
  it('handles percent and parens',()=>expect(evaluate('(100+50)×10%')).toBe(15));
  it('rejects divide by zero',()=>expect(()=>evaluate('5÷0')).toThrow());
  it('rejects code',()=>expect(()=>evaluate('alert(1)')).toThrow());
});
