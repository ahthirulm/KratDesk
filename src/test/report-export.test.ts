import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createReportArchive, reportMatches, reportPeriod } from '@/lib/report-export';

describe('report export archive', () => {
  it('includes a separate CSV for every selected report and a filter contents file', () => {
    const bytes = createReportArchive([
      { filename: 'sales', title: 'Jewellery sales', filters: '2026-11-16 to 2026-11-17', rows: [['Invoice', 'Total'], ['B1-INV-00007', 1000]] },
      { filename: 'expenses', title: 'Expenses', filters: 'Salaries', rows: [['Date', 'Amount'], ['2026-11-17', 500]] },
    ], [['Branch', 'City Jewels (B1)']]);
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['00-export-info.csv', '01-sales.csv', '02-expenses.csv']);
    expect(strFromU8(files['01-sales.csv']!)).toContain('B1-INV-00007');
    expect(strFromU8(files['00-export-info.csv']!)).toContain('2026-11-16 to 2026-11-17');
  });

  it('neutralises formulas in every CSV in the archive', () => {
    const bytes = createReportArchive([{ filename: 'sales', title: 'Sales', filters: 'All', rows: [['Customer'], ['=HYPERLINK("bad")']] }], []);
    const csv = strFromU8(unzipSync(bytes)['01-sales.csv']!);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });

  it('matches across searchable report fields and describes open periods', () => {
    expect(reportMatches('azzam', 'B1-INV-00007', 'Azzam', '0771234567')).toBe(true);
    expect(reportMatches('missing', 'B1-INV-00007', 'Azzam')).toBe(false);
    expect(reportMatches('', null)).toBe(true);
    expect(reportPeriod('', '')).toBe('All time');
    expect(reportPeriod('2026-11-01', '')).toBe('2026-11-01 to end');
  });
});
