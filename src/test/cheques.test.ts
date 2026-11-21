import {expect,it} from 'vitest';
import {chequeDue,validateCheque} from '@/lib/cheques';
it('requires cheque number',()=>expect(()=>validateCheque('Cheque',{cheque_number:'',cheque_date:'2026-11-17'})).toThrow('required'));
it('requires a valid cheque deposit date',()=>expect(()=>validateCheque('Cheque',{cheque_number:'123',cheque_date:'2026-02-30'})).toThrow('required'));
it('shows reminders on the cheque date and keeps overdue cheques due',()=>{expect(chequeDue({cheque_date:'2026-11-17',deposited_at:null},'2026-11-17')).toBe(true);expect(chequeDue({cheque_date:'2026-11-16',deposited_at:null},'2026-11-17')).toBe(true)});
it('does not remind early or after deposit',()=>{expect(chequeDue({cheque_date:'2026-11-18',deposited_at:null},'2026-11-17')).toBe(false);expect(chequeDue({cheque_date:'2026-11-17',deposited_at:'2026-11-17T10:00:00Z'},'2026-11-17')).toBe(false)});