export type ResetGroup = { id: string; label: string; note: string; wide: boolean };

// The data groups the database understands. `wide` items are shop-wide, so the
// database refuses them unless every branch is selected.
export const RESET_GROUPS: ResetGroup[] = [
  { id: 'stock', label: 'Jewellery stock', note: 'Pieces, tags, purchase costs and transfers', wide: false },
  { id: 'sales', label: 'Bills and sales', note: 'Invoices, bill lines, voids and returns', wide: false },
  { id: 'loans', label: 'Loans and repayments', note: 'Loan books, instalments, receipts and term changes', wide: false },
  { id: 'jobs', label: 'Jobs and orders', note: 'Repairs, custom orders and their payments', wide: false },
  { id: 'money', label: 'Money records', note: 'Expenses, owner cash, currency and old gold', wide: false },
  { id: 'reminders', label: 'Reminders and cheques', note: 'Reminders and cheque deposit tracking', wide: false },
  { id: 'customers', label: 'Customer list', note: 'Customers without bills, loans or jobs are removed', wide: true },
  { id: 'directories', label: 'Suppliers and categories', note: 'Supplier directory and stock categories', wide: true },
  { id: 'rates', label: 'Daily metal rates', note: 'Rate history for every metal', wide: true },
  { id: 'staff', label: 'Staff access', note: 'Approvals, custom roles and non-owner logins', wide: true },
  { id: 'audit', label: 'Audit history', note: 'The record of who changed what', wide: false },
];

export const RESET_GROUP_IDS = RESET_GROUPS.map((group) => group.id);

export function resetReady(phrase: string, password: string, branches: string[], groups: string[]): boolean {
  return phrase.trim().toUpperCase() === 'FACTORY RESET' && password.length > 0 && branches.length > 0 && groups.length > 0;
}
