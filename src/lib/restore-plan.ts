import { RESTORE_ORDER, scopedRows, type BackupFile } from './backup';

type Row = Record<string, unknown>;
export type RestorePlan = { table: string; column: string; values: string[]; clearAll: boolean; rows: Row[] };

/** Preserve this installation's metal directory while translating the backup's IDs. */
export function mapRestoreMetals(file: BackupFile, current: Row[]): BackupFile {
  const saved = new Map((file.tables['metal_types'] || []).map(row => [String(row['id']), String(row['name']).trim().toLowerCase()]));
  const currentIds = new Set(current.map(row => String(row['id'])));
  const names = new Map(current.map(row => [String(row['name']).trim().toLowerCase(), String(row['id'])]));
  const tables = Object.fromEntries(Object.entries(file.tables).map(([table, rows]) => [table, rows.map(row => {
    if (!row['metal_id']) return { ...row };
    const original = String(row['metal_id']);
    if (currentIds.has(original)) return { ...row };
    const name = saved.get(original);
    const mapped = name ? names.get(name) : undefined;
    if (!mapped) throw new Error('This backup uses a metal that cannot be matched. Include the metal directory in the backup and add any missing metal in Settings before restoring. No records were changed.');
    return { ...row, metal_id: mapped };
  })]));
  return { ...file, tables };
}

/** Delete current children first, then insert saved parents first, in one transaction. */
export function buildRestorePlans(file: BackupFile, current: BackupFile, branches: string[], everyBranch: boolean): RestorePlan[] {
  const incoming = new Map<string, Row[]>();
  const existing = new Map<string, Row[]>();
  return RESTORE_ORDER.map(spec => {
    const rows = scopedRows(spec, file, branches, everyBranch, incoming);
    const old = scopedRows(spec, current, branches, everyBranch, existing);
    incoming.set(spec.table, rows);
    existing.set(spec.table, old);
    const clearAll = everyBranch && (Boolean(spec.wide) || spec.table === 'audit_events');
    const column = spec.via?.key || spec.branch || spec.pk;
    const values = spec.wide ? [] : spec.branch ? branches : [...new Set(old.map(row => String(row[column])))];
    return { table: spec.table, column, values, clearAll, rows };
  });
}