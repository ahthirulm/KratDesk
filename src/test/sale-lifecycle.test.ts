import { describe, expect, it } from 'vitest';
import { createDemoStore } from '@/lib/demo-data';
import { applySaleLifecycle, effectiveLoanPaid, reversalAllocation, saleDeletionBlock, saleLifecycleStatus, type SaleReversal, type SaleReversalItem } from '@/lib/sale-lifecycle';

const store = createDemoStore('B1', '2026-11-17');
const sale = store.sales.find(row => row.loan_amount > 0)!;
const loan = store.loans.find(row => row.sale_id === sale.id)!;
const line = store.lines.find(row => row.sale_id === sale.id)!;

function reversal(overrides: Partial<SaleReversal> = {}): SaleReversal {
  return {
    id: 'reversal-1', sale_id: sale.id, branch_id: sale.branch_id, kind: 'Return', reason: 'Customer return', refund_method: 'Cash',
    total_amount: 500, paid_reduction: 100, credit_reduction: 400, loan_reduction: 300, payment_refund: 100,
    refund_amount: 200, created_by: 'owner-1', created_at: '2026-11-17T10:00:00Z', ...overrides,
  };
}

function reversalItem(overrides: Partial<SaleReversalItem> = {}): SaleReversalItem {
  return { id: 'return-item-1', reversal_id: 'reversal-1', sale_item_id: line.id, item_id: line.item_id, amount: 500, calculated_amount: 510, purchase_cost: 300, ...overrides };
}

describe('sale lifecycle integrity', () => {
  it('removes a voided sale, its lines and its loan from operational totals without changing raw history', () => {
    const voided = reversal({ kind: 'Void', total_amount: sale.final_total, paid_reduction: sale.paid_now, credit_reduction: sale.loan_amount });
    const result = applySaleLifecycle(store, [voided], [reversalItem()]);
    expect(result.sales.some(row => row.id === sale.id)).toBe(false);
    expect(result.loans.some(row => row.sale_id === sale.id)).toBe(false);
    expect(result.lines.some(row => row.sale_id === sale.id)).toBe(false);
    expect(store.sales.find(row => row.id === sale.id)?.final_total).toBe(sale.final_total);
  });

  it('subtracts a selected return from revenue, received cash and loan principal', () => {
    const result = applySaleLifecycle(store, [reversal()], [reversalItem()]);
    const netSale = result.sales.find(row => row.id === sale.id)!;
    expect(netSale.final_total).toBe(sale.final_total - 500);
    expect(netSale.paid_now).toBe(sale.paid_now - 100);
    expect(netSale.loan_amount).toBe(sale.loan_amount - 400);
    expect(netSale.calculated_total).toBe(sale.calculated_total - 510);
    expect(result.lines.some(row => row.id === line.id)).toBe(false);
    expect(result.loans.find(row => row.id === loan.id)?.amount).toBe(loan.amount - 400);
  });

  it('tracks repaid amounts net of repayment refunds', () => {
    expect(effectiveLoanPaid(loan, store.payments, [reversal()])).toBe(store.payments.filter(row => row.loan_id === loan.id).reduce((sum, row) => sum + row.amount, 0) - 100);
  });

  it('allocates a full void across original cash, outstanding loan and repayment refund', () => {
    const result = reversalAllocation({ sale, loan, payments: store.payments, reversals: [], amount: sale.final_total });
    const received = store.payments.filter(row => row.loan_id === loan.id).reduce((sum, row) => sum + row.amount, 0);
    expect(result.paidReduction).toBe(sale.paid_now);
    expect(result.creditReduction).toBe(sale.loan_amount);
    expect(result.loanReduction).toBe(sale.loan_amount - received);
    expect(result.paymentRefund).toBe(received);
    expect(result.refund).toBe(sale.paid_now + received);
  });

  it('blocks deleting a loan-linked sale with an actionable void instruction', () => {
    const message = saleDeletionBlock({ sale, loans: store.loans, cheques: [], reversals: [], items: store.items, lines: store.lines });
    expect(message).toContain(loan.loan_no);
    expect(message).toContain('Use Void bill');
  });

  it('allows deletion only for an unchanged standalone sale', () => {
    const standalone = store.sales.find(row => !store.loans.some(loanRow => loanRow.sale_id === row.id))!;
    expect(saleDeletionBlock({ sale: standalone, loans: store.loans, cheques: [], reversals: [], items: store.items, lines: store.lines })).toBe('');
    expect(saleDeletionBlock({ sale: standalone, loans: store.loans, cheques: [{ sale_id: standalone.id, cheque_number: 'CHQ-9' }], reversals: [], items: store.items, lines: store.lines })).toContain('CHQ-9');
  });

  it('distinguishes completed, partly returned, returned and voided bills', () => {
    expect(saleLifecycleStatus(sale, store.lines, [], [])).toBe('Completed');
    const multiLines = [...store.lines, { ...line, id: 'second-sale-line' }];
    expect(saleLifecycleStatus(sale, multiLines, [reversal()], [reversalItem()])).toBe('Part returned');
    const all = multiLines.filter(row => row.sale_id === sale.id);
    expect(saleLifecycleStatus(sale, store.lines, [reversal()], all.map((row, index) => reversalItem({ id: `return-${index}`, sale_item_id: row.id })))).toBe('Returned');
    expect(saleLifecycleStatus(sale, store.lines, [reversal({ kind: 'Void' })], [reversalItem()])).toBe('Voided');
  });
});
