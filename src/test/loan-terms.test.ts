import {expect,it} from 'vitest';
import {revisedSchedule} from '@/lib/loan-terms';
it('reschedules only the unpaid balance while preserving paid money',()=>expect(revisedSchedule(1000,250,{installments:3,frequency:'Monthly',first_due:'2026-12-01'},'2026-11-17').map(r=>r.amount)).toEqual([250,250,250,250]));
it('moves due dates without increasing the original loan',()=>{const p=revisedSchedule(100,0,{installments:2,frequency:'Monthly',first_due:'2027-01-31'},'2026-11-17');expect(p.map(r=>r.due_date)).toEqual(['2027-01-31','2027-02-28']);expect(p.reduce((s,r)=>s+r.amount,0)).toBe(100)});
it('changes frequency to weekly',()=>expect(revisedSchedule(100,0,{installments:2,frequency:'Weekly',first_due:'2026-12-01'},'2026-11-17')[1]?.due_date).toBe('2026-12-08'));
it('rejects closed loans',()=>expect(()=>revisedSchedule(100,100,{installments:2,frequency:'Monthly',first_due:'2026-12-01'},'2026-11-17')).toThrow('Closed'));
it('rejects more than 120 installments',()=>expect(()=>revisedSchedule(100,0,{installments:121,frequency:'Monthly',first_due:'2026-12-01'},'2026-11-17')).toThrow('count'));