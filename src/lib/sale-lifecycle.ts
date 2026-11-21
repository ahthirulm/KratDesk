import type { Store } from '@/components/pos/data';
import type { Database } from '@/integrations/supabase/types';
import { round } from './pos-rules';

export type SaleReversal = Database['public']['Tables']['sale_reversals']['Row'];
export type SaleReversalItem = Database['public']['Tables']['sale_reversal_items']['Row'];
type Sale = Store['sales'][number];
type Loan = Store['loans'][number];

export function reversalTotals(rows: SaleReversal[], saleId: string) {
  const selected = rows.filter(row => row.sale_id === saleId);
  const sum = (key: 'total_amount' | 'paid_reduction' | 'credit_reduction' | 'loan_reduction' | 'payment_refund' | 'refund_amount') => round(selected.reduce((total, row) => total + row[key], 0));
  return {
    total: sum('total_amount'),
    paidReduction: sum('paid_reduction'),
    creditReduction: sum('credit_reduction'),
    loanReduction: sum('loan_reduction'),
    paymentRefund: sum('payment_refund'),
    refund: sum('refund_amount'),
  };
}

// Operational screens see net active sales. The untouched originals remain in
// rawData for Sales history, invoices and the append-only audit trail.
export function applySaleLifecycle(store: Store, reversals: SaleReversal[], reversalItems: SaleReversalItem[]): Store {
  const voided = new Set(reversals.filter(row => row.kind === 'Void').map(row => row.sale_id));
  const returnedLines = new Set(reversalItems.map(row => row.sale_item_id));
  const sales = store.sales.filter(sale => !voided.has(sale.id)).map(sale => {
    const totals = reversalTotals(reversals, sale.id);
    const calculatedReturned = round(reversalItems.filter(item => reversals.some(row => row.id === item.reversal_id && row.sale_id === sale.id)).reduce((sum, item) => sum + item.calculated_amount, 0));
    return {
      ...sale,
      calculated_total: round(sale.calculated_total - calculatedReturned),
      final_total: round(sale.final_total - totals.total),
      paid_now: round(sale.paid_now - totals.paidReduction),
      loan_amount: round(sale.loan_amount - totals.creditReduction),
    };
  });
  const saleIds = new Set(sales.map(sale => sale.id));
  const loans = store.loans.filter(loan => saleIds.has(loan.sale_id)).map(loan => ({ ...loan, amount: round(loan.amount - reversalTotals(reversals, loan.sale_id).creditReduction) }));
  const loanIds = new Set(loans.map(loan => loan.id));
  const lines = store.lines.filter(line => saleIds.has(line.sale_id) && !returnedLines.has(line.id));
  const lineIds = new Set(lines.map(line => line.id));
  return {
    ...store,
    sales,
    lines,
    costs: store.costs.filter(cost => lineIds.has(cost.sale_item_id)),
    loans,
    installments: store.installments.filter(row => loanIds.has(row.loan_id)),
    payments: store.payments.filter(row => loanIds.has(row.loan_id)),
    reversals,
    reversalItems,
    grossSales: store.sales,
    grossPayments: store.payments,
  };
}

export function effectiveLoanPaid(loan: Loan, payments: Store['payments'], reversals: SaleReversal[]) {
  const received = round(payments.filter(row => row.loan_id === loan.id).reduce((sum, row) => sum + row.amount, 0));
  return round(received - reversalTotals(reversals, loan.sale_id).paymentRefund);
}

export function saleLifecycleStatus(sale: Sale, lines: Store['lines'], reversals: SaleReversal[], reversalItems: SaleReversalItem[]) {
  if (reversals.some(row => row.sale_id === sale.id && row.kind === 'Void')) return 'Voided';
  const returned = new Set(reversalItems.filter(item => reversals.some(row => row.id === item.reversal_id && row.sale_id === sale.id)).map(item => item.sale_item_id));
  if (!returned.size) return 'Completed';
  const original = lines.filter(line => line.sale_id === sale.id);
  return original.every(line => returned.has(line.id)) ? 'Returned' : 'Part returned';
}

export function saleDeletionBlock({ sale, loans, cheques, reversals, items, lines }: {
  sale: Sale;
  loans: Store['loans'];
  cheques: { sale_id: string | null; cheque_number: string }[];
  reversals: SaleReversal[];
  items: Store['items'];
  lines: Store['lines'];
}) {
  const loan = loans.find(row => row.sale_id === sale.id);
  if (loan) return `Loan ${loan.loan_no} is linked. Use Void bill so the loan and reports stay correct; deletion is blocked.`;
  if (reversals.some(row => row.sale_id === sale.id)) return 'This bill has return or void history and must remain for accurate reports.';
  const cheque = cheques.find(row => row.sale_id === sale.id);
  if (cheque) return `Cheque ${cheque.cheque_number} is linked. Use Void bill to retain its payment history.`;
  const saleLines = lines.filter(line => line.sale_id === sale.id);
  if (!saleLines.length) return 'This bill has no pieces and cannot be deleted safely.';
  const changed = saleLines.some(line => {
    const item = items.find(row => row.id === line.item_id);
    return !item || item.status !== 'Sold' || item.sold_invoice !== sale.invoice_no;
  });
  if (changed) return 'A piece already has later stock or sales history. Keep this bill and use a return instead.';
  return '';
}

export function reversalAllocation({ sale, loan, payments, reversals, amount }: {
  sale: Sale;
  loan: Loan | undefined;
  payments: Store['payments'];
  reversals: SaleReversal[];
  amount: number;
}) {
  const previous = reversalTotals(reversals, sale.id);
  const paidReduction = round(Math.min(amount, Math.max(0, sale.paid_now - previous.paidReduction)));
  const creditReduction = round(amount - paidReduction);
  const received = loan ? round(payments.filter(row => row.loan_id === loan.id).reduce((sum, row) => sum + row.amount, 0)) : 0;
  const outstanding = loan ? round(Math.max(0, loan.amount - previous.loanReduction - received)) : 0;
  const loanReduction = loan ? round(Math.min(creditReduction, outstanding)) : 0;
  const paymentRefund = round(creditReduction - loanReduction);
  return { paidReduction, creditReduction, loanReduction, paymentRefund, refund: round(paidReduction + paymentRefund) };
}
