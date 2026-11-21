import { createContext, useCallback, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadReportArchive, downloadReportCsv, type ReportArchiveFile, type ReportRows } from '@/lib/report-export';
import type { ReportTab } from '@/lib/report-tabs';

export type ReportDocument = ReportArchiveFile & {
  id: ReportTab;
  loading?: boolean | undefined;
  error?: string | undefined;
};

type Registry = {
  register: (document: ReportDocument) => void;
  remove: (id: ReportTab) => void;
  files?: MutableRefObject<Map<ReportTab, ReportDocument>>;
};

const ReportRegistryContext = createContext<Registry>({ register: () => {}, remove: () => {} });

export function ReportExportProvider({ children }: { children: ReactNode }) {
  const files = useRef(new Map<ReportTab, ReportDocument>());
  const register = useCallback((document: ReportDocument) => { files.current.set(document.id, document); }, []);
  const remove = useCallback((id: ReportTab) => { files.current.delete(id); }, []);
  return <ReportRegistryContext value={{ register, remove, files }}>{children}</ReportRegistryContext>;
}

export function useReportExport(document: ReportDocument) {
  const { register, remove } = useContext(ReportRegistryContext);
  useEffect(() => { register(document); });
  useEffect(() => () => remove(document.id), [document.id, remove]);
}

export function useGeneralReportExport() {
  const { files } = useContext(ReportRegistryContext);
  return useCallback((expected: ReportTab[], branch: string, branchName: string) => {
    const selected = expected.map(id => files?.current.get(id));
    if (selected.some(file => !file)) throw new Error('Reports are still preparing. Please try again in a moment.');
    const ready = selected as ReportDocument[];
    const loading = ready.find(file => file.loading);
    if (loading) throw new Error(`${loading.title} is still loading.`);
    const failed = ready.find(file => file.error);
    if (failed) throw new Error(`${failed.title}: ${failed.error}`);
    downloadReportArchive(ready, [
      ['Branch', `${branchName} (${branch})`],
      ['Generated at', new Date().toISOString()],
      ['Scope', 'Only reports you are permitted to view; each report keeps its current filters.'],
    ], branch);
  }, [files]);
}

export function FilteredCsvButton({ filename, rows, count }: { filename: string; rows: ReportRows; count: number }) {
  return <Button variant="outline" onClick={() => downloadReportCsv(filename, rows)} disabled={!count} title={count ? `Export ${count} filtered rows` : 'No filtered rows to export'}><Download />Export filtered CSV ({count})</Button>;
}
