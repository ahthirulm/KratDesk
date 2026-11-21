import { expect, it } from 'vitest';
import { saleDateError } from '@/lib/sale-date';

it('allows a sale recorded today', () => {
  expect(saleDateError('2026-11-17', '2026-11-17')).toBeNull();
});

it('allows yesterday\u2019s sale entered today', () => {
  expect(saleDateError('2026-11-16', '2026-11-17')).toBeNull();
});

it('rejects a future sale date', () => {
  expect(saleDateError('2026-11-18', '2026-11-17')).toBe('The sale date cannot be in the future');
});

it('rejects a missing or malformed sale date', () => {
  expect(saleDateError('', '2026-11-17')).toBe('Enter a valid sale date');
  expect(saleDateError('17-11-2026', '2026-11-17')).toBe('Enter a valid sale date');
});
