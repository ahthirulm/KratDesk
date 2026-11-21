import { expect, it } from 'vitest';
import { inReportPeriod,reportDate } from '@/lib/report-period';

it('includes the complete history when both report dates are blank', () => {
  expect(inReportPeriod('2020-01-01', '', '')).toBe(true);
  expect(inReportPeriod('2030-12-31', '', '')).toBe(true);
});

it('keeps custom report dates inclusive and excludes outside dates', () => {
  expect(inReportPeriod('2026-11-01', '2026-11-01', '2026-11-17')).toBe(true);
  expect(inReportPeriod('2026-11-17', '2026-11-01', '2026-11-17')).toBe(true);
  expect(inReportPeriod('2026-10-31', '2026-11-01', '2026-11-17')).toBe(false);
  expect(inReportPeriod('2026-11-18', '2026-11-01', '2026-11-17')).toBe(false);
});

it('accepts only complete calendar-date values in report links',()=>{
 expect(reportDate('2026-11-17')).toBe('2026-11-17');
 expect(reportDate('11/17/2026')).toBeUndefined();
 expect(reportDate('')).toBeUndefined();
 expect(reportDate(undefined)).toBeUndefined();
});
