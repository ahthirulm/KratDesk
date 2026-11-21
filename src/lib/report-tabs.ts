export const REPORT_TABS = ['jewellery', 'daily-close', 'stock', 'loan-age', 'expenses', 'staff', 'repairs', 'owner-cash', 'currency', 'old-gold'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export function reportTab(value: unknown): ReportTab | undefined {
  return typeof value === 'string' && (REPORT_TABS as readonly string[]).includes(value)
    ? (value as ReportTab)
    : undefined;
}
