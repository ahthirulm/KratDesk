// Everything the backup file contains and the order a restore must put it back
// in. Parents come before children so foreign keys are never violated.
export const BACKUP_TABLES = [
  'branches', 'settings', 'metal_types', 'daily_rates', 'stock_categories', 'suppliers',
  'items', 'item_costs', 'stock_movements', 'customers',
  'sales', 'sale_items', 'sale_costs', 'sale_reversals', 'sale_reversal_items',
  'loans', 'loan_installments', 'loan_payments', 'loan_term_revisions',
  'cheque_reminders', 'reminders',
  'petty_cash_categories', 'petty_cash_entries', 'expense_staff', 'capital_movements',
  'fx_currencies', 'fx_accounts', 'fx_entries',
  'old_gold_accounts', 'old_gold_entries', 'old_gold_movements',
  'job_types', 'repair_jobs', 'repair_job_events',
  'profiles', 'user_roles', 'staff_roles', 'staff_access', 'audit_events',
] as const;

export type BackupFile = {
  app: 'KaratDesk';
  created_at: string;
  /** Branches the file covers; absent on files written before this existed. */
  branches?: string[];
  tables: Record<string, Record<string, unknown>[]>;
};

export type RestoreSpec = {
  table: string;
  /** Column that names the branch a row belongs to. */
  branch?: string;
  /** Row belongs to a parent table already restored in this run. */
  via?: { parent: string; key: string };
  /** Shop-wide: only restored when every branch is selected. */
  wide?: boolean;
  /** Primary key column, used to clear a shop-wide table. */
  pk: string;
};

// Logins (profiles, user_roles), branch records, shop settings and metal types
// are deliberately left out: a restore must never overwrite how people sign in.
export const RESTORE_ORDER: RestoreSpec[] = [
  { table: 'daily_rates', wide: true, pk: 'date' },
  { table: 'stock_categories', wide: true, pk: 'name' },
  { table: 'suppliers', wide: true, pk: 'id' },
  { table: 'customers', wide: true, pk: 'id' },
  { table: 'job_types', wide: true, pk: 'name' },
  { table: 'items', branch: 'branch_id', pk: 'id' },
  { table: 'item_costs', via: { parent: 'items', key: 'item_id' }, pk: 'item_id' },
  { table: 'stock_movements', branch: 'from_branch', pk: 'id' },
  { table: 'sales', branch: 'branch_id', pk: 'id' },
  { table: 'sale_items', via: { parent: 'sales', key: 'sale_id' }, pk: 'id' },
  { table: 'sale_costs', via: { parent: 'sale_items', key: 'sale_item_id' }, pk: 'sale_item_id' },
  { table: 'sale_reversals', branch: 'branch_id', pk: 'id' },
  { table: 'sale_reversal_items', via: { parent: 'sale_reversals', key: 'reversal_id' }, pk: 'id' },
  { table: 'loans', branch: 'branch_id', pk: 'id' },
  { table: 'loan_installments', via: { parent: 'loans', key: 'loan_id' }, pk: 'id' },
  { table: 'loan_payments', branch: 'branch_id', pk: 'id' },
  { table: 'loan_term_revisions', via: { parent: 'loans', key: 'loan_id' }, pk: 'id' },
  { table: 'cheque_reminders', branch: 'branch_id', pk: 'id' },
  { table: 'reminders', branch: 'branch_id', pk: 'id' },
  { table: 'petty_cash_categories', branch: 'branch_id', pk: 'id' },
  { table: 'expense_staff', branch: 'branch_id', pk: 'id' },
  { table: 'petty_cash_entries', branch: 'branch_id', pk: 'id' },
  { table: 'capital_movements', branch: 'branch_id', pk: 'id' },
  { table: 'fx_accounts', branch: 'branch_id', pk: 'branch_id' },
  { table: 'fx_entries', branch: 'branch_id', pk: 'id' },
  { table: 'old_gold_accounts', branch: 'branch_id', pk: 'branch_id' },
  { table: 'old_gold_entries', branch: 'branch_id', pk: 'id' },
  { table: 'old_gold_movements', branch: 'from_branch', pk: 'id' },
  { table: 'repair_jobs', branch: 'branch_id', pk: 'id' },
  { table: 'repair_job_events', branch: 'branch_id', pk: 'id' },
  { table: 'audit_events', branch: 'branch_id', pk: 'id' },
];

export const SPEC_BY_TABLE: Record<string, RestoreSpec> = Object.fromEntries(
  RESTORE_ORDER.map((spec) => [spec.table, spec]),
);

export function isEncryptedBackup(contents: string): boolean {
  try {
    const parsed = JSON.parse(contents) as { app?: string; encrypted?: boolean };
    return parsed.app === 'KaratDesk' && parsed.encrypted === true;
  } catch {
    return false;
  }
}

export function backupRecordCount(file: BackupFile): number {
  return Object.values(file.tables).reduce((total, rows) => total + (rows?.length || 0), 0);
}

/**
 * Rows of one table that belong in a backup of the chosen branches.
 * Shop-wide records and sign-in records are always kept so the file can still
 * be restored. `kept` carries each table's saved row ids so child tables
 * (bill lines, instalments) only travel with the parents that were kept.
 */
export function backupRowsFor(
  table: string,
  rows: Record<string, unknown>[],
  branches: string[],
  kept: Map<string, Set<string>>,
): Record<string, unknown>[] {
  const spec = SPEC_BY_TABLE[table];
  if (!spec) return rows;
  let out = rows;
  if (spec.branch) {
    const column = spec.branch;
    const wanted = new Set(branches);
    out = rows.filter((row) => wanted.has(String(row[column])));
  } else if (spec.via) {
    const key = spec.via.key;
    const ids = kept.get(spec.via.parent) || new Set<string>();
    out = rows.filter((row) => ids.has(String(row[key])));
  }
  kept.set(table, new Set(out.map((row) => String(row[spec.pk]))));
  return out;
}

/** Rows of one table that belong to the branches being restored. */
export function scopedRows(
  spec: RestoreSpec,
  file: BackupFile,
  branches: string[],
  everyBranch: boolean,
  restored: Map<string, Record<string, unknown>[]>,
): Record<string, unknown>[] {
  const rows = file.tables[spec.table] || [];
  if (spec.wide) return everyBranch ? rows : [];
  if (spec.via) {
    const key = spec.via.key;
    const parentSpec = SPEC_BY_TABLE[spec.via.parent];
    const parents = restored.get(spec.via.parent) || [];
    const ids = new Set(parents.map((row) => String(row[parentSpec ? parentSpec.pk : key])));
    return rows.filter((row) => ids.has(String(row[key])));
  }
  const column = spec.branch as string;
  const wanted = new Set(branches);
  return rows.filter((row) => wanted.has(String(row[column])));
}
