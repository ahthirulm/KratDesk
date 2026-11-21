import type { Store } from '@/components/pos/data';
import type { Database } from '@/integrations/supabase/types';
import { allocate, round, today } from './pos-rules';
import { effectiveLoanPaid } from './sale-lifecycle';

type Loan = Store['loans'][number];
type Installment = Store['installments'][number];
type Payment = Store['payments'][number];
type Revision = Database['public']['Tables']['loan_term_revisions']['Row'];
type Reversal = Database['public']['Tables']['sale_reversals']['Row'];

type Planned = { id: string; installment_no: number; due_date: string; amount: number };

export type ScheduleRow = Planned & {
  loan_id: string;
  loan_no: string;
  paid: number;
  balance: number;
  status: string;
};

// A saved term revision is the plan of record; the originally issued rows only
// stand when no revision exists, so rescheduled loans never show a stale table.
function plannedRows(loan: Loan, installments: Installment[], revisions: Revision[]): Planned[] {
  const original = installments
    .filter(row => row.loan_id === loan.id)
    .map(row => ({ id: row.id, installment_no: row.installment_no, due_date: row.due_date, amount: row.amount }));
  const revision = revisions.find(row => row.loan_id === loan.id);
  if (!revision || !Array.isArray(revision.schedule)) return original;
  const revised = revision.schedule.flatMap((entry, index): Planned[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row['amount'] !== 'number' || typeof row['due_date'] !== 'string' || typeof row['installment_no'] !== 'number') return [];
    return [{ id: `${revision.id}-${index}`, installment_no: row['installment_no'], due_date: row['due_date'], amount: row['amount'] }];
  });
  return revised.length ? revised : original;
}

export function loanSchedule(
  loan: Loan,
  installments: Installment[],
  payments: Payment[],
  revisions: Revision[],
  reversals: Reversal[],
  date = today(),
): ScheduleRow[] {
  const paid = effectiveLoanPaid(loan, payments, reversals);
  return allocate(plannedRows(loan, installments, revisions), paid, date).map(row => ({
    ...row,
    id: String(row.id ?? `${loan.id}-${row.installment_no}`),
    loan_id: loan.id,
    loan_no: loan.loan_no,
  }));
}

export function customerSchedule(
  loans: Loan[],
  installments: Installment[],
  payments: Payment[],
  revisions: Revision[],
  reversals: Reversal[],
  date = today(),
): ScheduleRow[] {
  return loans
    .flatMap(loan => loanSchedule(loan, installments, payments, revisions, reversals, date))
    .sort((a, b) => (a.due_date === b.due_date ? a.installment_no - b.installment_no : a.due_date.localeCompare(b.due_date)));
}

export function scheduleSummary(rows: ScheduleRow[], date = today()) {
  const outstanding = rows.filter(row => row.balance > 0);
  const next = outstanding.reduce<ScheduleRow | null>((earliest, row) => (!earliest || row.due_date < earliest.due_date ? row : earliest), null);
  return {
    next,
    count: outstanding.length,
    overdue: round(outstanding.filter(row => row.due_date < date).reduce((sum, row) => sum + row.balance, 0)),
    remaining: round(outstanding.reduce((sum, row) => sum + row.balance, 0)),
  };
}
