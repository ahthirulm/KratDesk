import {describe,it,expect} from 'vitest';
import {parseGoldQuote,colomboDate} from '@/lib/gold-rates';
import {displayReference} from '@/lib/display-reference';
const now=new Date('2026-11-17T10:00:00Z');
const response={success:true,currency:'LKR',source_date:'2026-11-16',fetched_at:'2026-11-17T09:00:00Z',unit:{name:'pawn',weight_grams:8},prices:{'22K':329400,'24K':358000}};
describe('Gold Rates LKR adapter',()=>{
 it('keeps publication separate from fetch date and preserves pawn units',()=>{expect(parseGoldQuote(response,now)).toEqual({sourceDate:'2026-11-16',prices:{'22K':329400,'24K':358000}})});
 it.each([{currency:'USD'},{unit:{name:'gram',weight_grams:1}},{source_date:null},{source_date:'2026-11-18'},{source_date:'2026-02-30'},{prices:{'22K':0,'24K':358000}},{prices:{'22K':NaN,'24K':358000}},{prices:{'22K':329400}},{prices:{'22K':'329400','24K':358000}},{success:false}])('rejects invalid result %j',patch=>expect(()=>parseGoldQuote({...response,...patch},now)).toThrow());
 it('uses Colombo day boundary',()=>expect(colomboDate(new Date('2026-11-17T19:00:00Z'))).toBe('2026-11-18'));
});
describe('human references',()=>{
 it('removes only the known UUID prefix from supported document references',()=>{expect(displayReference('0e6653b8-6834-4a46-b9de-516a8ba14d73-INV-00003')).toBe('INV-00003');expect(displayReference('0e6653b8-6834-4a46-b9de-516a8ba14d73-LN-00001')).toBe('LN-00001');expect(displayReference('custom-INV-03')).toBe('custom-INV-03');expect(displayReference(null)).toBe('')});
});
