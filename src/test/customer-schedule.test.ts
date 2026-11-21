import { describe, expect, it } from 'vitest';
import type { Store } from '@/components/pos/data';
import type { Database } from '@/integrations/supabase/types';
import type { SaleReversal } from '@/lib/sale-lifecycle';
import { customerSchedule, scheduleSummary } from '@/lib/customer-schedule';

type Revision = Database['public']['Tables']['loan_term_revisions']['Row'];

const loan: Store['loans'][number] = {
  id: 'loan-1', loan_no: 'LN-1', sale_id: 'sale-1', customer_id: 'cust-1', amount: 30000,
  frequency: 'Monthly', status: 'Active', created_at: '2026-10-01T00:00:00Z', branch_id: 'B1',
};

const installments: Store['installments'][number][] = [
  { id: 'inst-1', loan_id: 'loan-1', installment_no: 1, due_date: '2026-11-01', amount: 10000 },
  { id: 'inst-2', loan_id: 'loan-1', installment_no: 2, due_date: '2026-12-01', amount: 10000 },
  { id: 'inst-3', loan_id: 'loan-1', installment_no: 3, due_date: '2027-01-01', amount: 10000 },
];

const payment: Store['payments'][number] = {
  id: 'pay-1', loan_id: 'loan-1', receipt_no: 'R-1', date: '2026-11-10', amount: 12000,
  method: 'Cash', received_by: 'user-1', branch_id: 'B1',
};

const revision = (schedule: Revision['schedule']): Revision => ({
  id: 'rev-1', loan_id: 'loan-1', frequency: 'Monthly', installment_count: 2, first_due: '2026-12-01',
  paid_at_revision: 12000, schedule, created_by: 'user-1', created_at: '2026-11-11T00:00:00Z',
});

const noReversals: SaleReversal[] = [];

describe('customer installment schedule', () => {
  it('splits recorded repayments across the issued installments in date order', () => {
    const rows = customerSchedule([loan], installments, [payment], [], noReversals, '2026-11-17');
    expect(rows.map(r => r.due_date)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
    expect(rows.map(r => r.paid)).toEqual([10000, 2000, 0]);
    expect(rows.map(r => r.balance)).toEqual([0, 8000, 10000]);
    expect(rows.map(r => r.status)).toEqual(['Paid', 'Partial', 'Due']);
  });

  it('uses a saved term revision instead of the originally issued installments', () => {
    const rows = customerSchedule([loan], installments, [payment], [revision([
      { installment_no: 1, due_date: '2026-12-01', amount: 9000 },
      { installment_no: 2, due_date: '2027-01-01', amount: 9000 },
    ])], noReversals, '2026-11-17');
    expect(rows.map(r => `${r.due_date}:${r.amount}:${r.balance}`)).toEqual(['2026-12-01:9000:0', '2027-01-01:9000:6000']);
  });

  it('summarises the next due date and overdue amount for the profile header', () => {
    const summary = scheduleSummary(customerSchedule([loan], installments, [payment], [], noReversals, '2026-11-17'), '2026-11-17');
    expect(summary.next?.due_date).toBe('2026-12-01');
    expect(summary.next?.balance).toBe(8000);
    expect(summary.remaining).toBe(18000);
    expect(summary.overdue).toBe(0);
    expect(summary.count).toBe(2);
  });

  it('counts an unpaid installment as overdue once its date has passed', () => {
    const summary = scheduleSummary(customerSchedule([loan], installments, [], [], noReversals, '2026-11-17'), '2026-11-17');
    expect(summary.overdue).toBe(10000);
    expect(summary.remaining).toBe(30000);
    expect(summary.next?.due_date).toBe('2026-11-01');
  });

  it('ignores a refunded payment when working out what is still owed', () => {
    const reversal: SaleReversal = {
      id: 'rev-1', sale_id: 'sale-1', branch_id: 'B1', kind: 'Return', reason: 'Piece returned', refund_method: 'Cash',
      total_amount: 2000, paid_reduction: 0, credit_reduction: 2000, loan_reduction: 0, payment_refund: 2000,
      refund_amount: 2000, created_by: 'user-1', created_at: '2026-11-12T00:00:00Z',
    };
    const summary = scheduleSummary(customerSchedule([loan], installments, [payment], [], [reversal], '2026-11-17'), '2026-11-17');
    expect(summary.remaining).toBe(20000);
  });
});
