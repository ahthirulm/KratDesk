import { expect, it } from 'vitest';
import { validateExpensePayee } from '@/lib/expense-payees';

it('creates an outside-shop payee with optional phone and note', () => {
  expect(validateExpensePayee('  Kamal Electrical  ', 'Outside shop', ' 077 123 4567 ', ' Repair contact ')).toEqual({
    name: 'Kamal Electrical', payee_type: 'Outside shop', phone: '077 123 4567', note: 'Repair contact',
  });
});

it('allows a shop-staff profile with name only', () => {
  expect(validateExpensePayee('Nadeesha', 'Shop staff', '', '').phone).toBe('');
});

it('rejects an unknown payee type', () => {
  expect(() => validateExpensePayee('Kamal', 'Administrator', '', '')).toThrow('shop staff or outside shop');
});

it('requires a payee name', () => {
  expect(() => validateExpensePayee('  ', 'Outside shop', '', '')).toThrow('payee name');
});

it('limits phone and note lengths', () => {
  expect(() => validateExpensePayee('Kamal', 'Shop staff', '7'.repeat(41), '')).toThrow('Phone');
  expect(() => validateExpensePayee('Kamal', 'Shop staff', '', 'x'.repeat(501))).toThrow('Note');
});
