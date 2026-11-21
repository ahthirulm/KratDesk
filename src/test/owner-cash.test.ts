import {describe,it,expect} from 'vitest';
import {mainCashEffect,capitalSummary,validateOwnerCash} from '@/lib/owner-cash';
describe('owner cash',()=>{
 it('cash in and bank withdrawal add to main cash',()=>{expect(mainCashEffect('Owner cash in',500)).toBe(500);expect(mainCashEffect('Bank withdrawal',200)).toBe(200)});
 it('cash out and bank deposit reduce main cash',()=>{expect(mainCashEffect('Owner cash out',500)).toBe(-500);expect(mainCashEffect('Bank deposit',200)).toBe(-200)});
 it('blocks cash out above main cash',()=>{expect(()=>validateOwnerCash('Owner cash out',1001,1000,0)).toThrow()});
 it('blocks bank withdrawal above bank balance',()=>{expect(()=>validateOwnerCash('Bank withdrawal',301,0,300)).toThrow()});
 it('summarises invested, withdrawn and bank',()=>{expect(capitalSummary([{kind:'Owner cash in',amount:1000},{kind:'Owner cash out',amount:250},{kind:'Bank deposit',amount:400},{kind:'Bank withdrawal',amount:100}])).toEqual({invested:1000,withdrawn:250,net:750,bank:300})});
});
