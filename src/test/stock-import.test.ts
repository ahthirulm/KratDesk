import { it, expect } from 'vitest';
import { parseStockImport } from '@/lib/stock-import';

const row = { 'Internal tag': 'CJ-001', 'Item name': 'Ring', Metal: '22K Gold', Category: 'Ring', 'Weight (g)': 41.350, 'Purchase price': 1000 };

it('retains the exact imported milligram weight', () => expect(parseStockImport([row], [], ['22K Gold'], ['Ring'])[0]?.item.weight).toBe(41.350));
it('accepts the v2 purchase-price header without changing the imported value', () => {
  const { 'Purchase price': _removed, ...legacyBase } = row;
  const legacy = { ...legacyBase, 'Purchase price (LKR)': 1000 };
  expect(parseStockImport([legacy], [], ['22K Gold'], ['Ring'])[0]?.item.cost).toBe(1000);
});
it('rejects duplicate internal tags before saving', () => expect(parseStockImport([row], ['cj-001'], ['22K Gold'], ['Ring'])[0]?.errors).toContain('Internal tag is already used'));
it('rejects weights beyond stored precision instead of rounding', () => expect(parseStockImport([{ ...row, 'Weight (g)': 41.3501 }], [], ['22K Gold'], ['Ring'])[0]?.errors.length).toBeGreaterThan(0));
