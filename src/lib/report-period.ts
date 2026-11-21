export function inReportPeriod(date: string, from: string, to: string) {
  return (!from || date >= from) && (!to || date <= to);
}

export function reportDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
