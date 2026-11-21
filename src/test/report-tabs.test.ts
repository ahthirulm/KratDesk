import { describe, expect, it } from 'vitest';
import { reportTab } from '@/lib/report-tabs';

describe('report tab links', () => {
  it.each(['jewellery', 'currency', 'old-gold'] as const)('keeps the valid %s report selection', tab => {
    expect(reportTab(tab)).toBe(tab);
  });

  it.each([undefined, null, '', 'profit', 1])('ignores an invalid selection: %s', value => {
    expect(reportTab(value)).toBeUndefined();
  });
});
