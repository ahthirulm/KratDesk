export type SpreadsheetValue = string | number | boolean | null | undefined;

/** Prevent spreadsheet programs from interpreting user-entered text as a formula. */
export function neutralizeSpreadsheetText(value: string) {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}

export function spreadsheetValue(value: unknown) {
  return typeof value === 'string' ? neutralizeSpreadsheetText(value) : value;
}

export function sanitizeSpreadsheetRecords<T extends Record<string, unknown>>(records: T[]) {
  return records.map((record) => Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, spreadsheetValue(value)]),
  ));
}

export function toSafeCsv(rows: SpreadsheetValue[][]) {
  return rows.map((row) => row.map((value) => {
    const safe = spreadsheetValue(value);
    return `"${String(safe ?? '').replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
}
