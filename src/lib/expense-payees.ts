export const EXPENSE_PAYEE_TYPES = ['Shop staff', 'Outside shop'] as const;
export type ExpensePayeeType = (typeof EXPENSE_PAYEE_TYPES)[number];

export function validateExpensePayee(name: string, payeeType: string, phone: string, note: string) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 120) throw new Error('Enter a valid payee name');
  if (!EXPENSE_PAYEE_TYPES.includes(payeeType as ExpensePayeeType)) throw new Error('Choose shop staff or outside shop');
  const cleanPhone = phone.trim();
  const cleanNote = note.trim();
  if (cleanPhone.length > 40) throw new Error('Phone number is too long');
  if (cleanNote.length > 500) throw new Error('Note is too long');
  return { name: cleanName, payee_type: payeeType as ExpensePayeeType, phone: cleanPhone, note: cleanNote };
}
