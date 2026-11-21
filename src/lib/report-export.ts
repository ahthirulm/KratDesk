import { strToU8, zipSync } from 'fflate';
import { downloadBlob } from './download';
import { toSafeCsv, type SpreadsheetValue } from './spreadsheet';

export type ReportRows = SpreadsheetValue[][];
export type ReportArchiveFile = {
  filename: string;
  title: string;
  filters: string;
  rows: ReportRows;
};

export function reportMatches(search: string, ...values: unknown[]) {
  const query = search.trim().toLocaleLowerCase();
  return !query || values.some(value => String(value ?? '').toLocaleLowerCase().includes(query));
}

export function reportPeriod(from: string, to: string) {
  return from || to ? `${from || 'start'} to ${to || 'end'}` : 'All time';
}

function safeFilename(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
}

export function reportCsv(rows: ReportRows) {
  return `\uFEFF${toSafeCsv(rows)}`;
}

export function createReportArchive(files: ReportArchiveFile[], context: ReportRows) {
  const archive: Record<string, Uint8Array> = {};
  const contents: ReportRows = [
    ['KaratDesk general report export'],
    ...context,
    [],
    ['REPORT', 'FILTERS', 'DATA ROWS', 'FILE'],
  ];
  files.forEach((file, index) => {
    const filename = `${String(index + 1).padStart(2, '0')}-${safeFilename(file.filename)}.csv`;
    archive[filename] = strToU8(reportCsv(file.rows));
    contents.push([file.title, file.filters, Math.max(0, file.rows.length - 1), filename]);
  });
  archive['00-export-info.csv'] = strToU8(reportCsv(contents));
  return zipSync(archive, { level: 6 });
}

export function downloadReportCsv(filename: string, rows: ReportRows) {
  downloadBlob(new Blob([reportCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(filename)}.csv`);
}

export function downloadReportArchive(files: ReportArchiveFile[], context: ReportRows, branch: string) {
  const bytes = createReportArchive(files, context);
  downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }), `karatdesk-reports-${safeFilename(branch)}-${new Date().toISOString().slice(0, 10)}.zip`);
}
