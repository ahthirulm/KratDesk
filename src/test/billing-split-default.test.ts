import { expect, it } from 'vitest';
import { DEFAULT_SPLIT_FIRST, DEFAULT_SPLIT_SECOND } from '@/lib/payment-labels';

it('defaults Split billing to Cash plus Loan', () => {
  expect(DEFAULT_SPLIT_FIRST).toBe('Cash');
  expect(DEFAULT_SPLIT_SECOND).toBe('Loan');
});
