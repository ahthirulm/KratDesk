import {describe,expect,it} from 'vitest';
import {COUNTRY_CURRENCIES,currencyDetails,currencySymbol} from '@/lib/country-currencies';

describe('country currency directory',()=>{
 it('includes every generated country/currency choice only once',()=>{
  expect(COUNTRY_CURRENCIES.length).toBe(276);
  expect(new Set(COUNTRY_CURRENCIES.map(option=>option.id)).size).toBe(COUNTRY_CURRENCIES.length);
  expect(COUNTRY_CURRENCIES.every(option=>option.flag&&option.country&&/^[A-Z]{3}$/.test(option.code))).toBe(true);
 });

 it('provides familiar currency symbols',()=>{
  expect(currencySymbol('USD')).toBe('$');
  expect(currencySymbol('EUR')).toBe('€');
  expect(currencySymbol('GBP')).toBe('£');
  expect(currencyDetails('USD')?.country).toBe('United States');
  expect(currencyDetails('EUR')?.country).toBe('European Union');
 });

 it('includes Sri Lanka but marks its currency for exclusion from foreign-exchange selection',()=>{
  expect(COUNTRY_CURRENCIES.some(option=>option.id==='LK:LKR'&&option.flag==='🇱🇰')).toBe(true);
 });
});
