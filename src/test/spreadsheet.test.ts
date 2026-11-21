import { describe, expect, it } from 'vitest';
import { neutralizeSpreadsheetText, sanitizeSpreadsheetRecords, toSafeCsv } from '@/lib/spreadsheet';

describe('spreadsheet export safety', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("bad")', '\t=1+1'])('neutralises formula-leading text: %j', (value) => {
    expect(neutralizeSpreadsheetText(value).startsWith("'")).toBe(true);
  });

  it('preserves ordinary text and numeric values', () => {
    expect(neutralizeSpreadsheetText('Nadeesha Perera')).toBe('Nadeesha Perera');
    expect(neutralizeSpreadsheetText('LKR -500')).toBe('LKR -500');
    expect(sanitizeSpreadsheetRecords([{ Profit: -500, Customer: 'Walk-in' }])).toEqual([{ Profit: -500, Customer: 'Walk-in' }]);
  });

  it('quotes cells and neutralises every user-controlled column', () => {
    const csv = toSafeCsv([['Customer', 'Reference'], ['=1+1', 'He said "hello"']]);
    expect(csv).toBe('"Customer","Reference"\n"\'=1+1","He said ""hello"""');
  });
});
