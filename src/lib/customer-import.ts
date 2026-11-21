export type CustomerImportRow = { row: number; name: string; phone: string; errors: string[] };

const pick = (raw: Record<string, unknown>, keys: string[]) => {
  const key = Object.keys(raw).find(k => keys.includes(k.trim().toLowerCase()));
  return key ? String(raw[key] ?? '').trim() : '';
};

/** Validates rows before saving: name + phone required, phones unique in file and against existing customers. */
export function parseCustomerImport(raw: Record<string, unknown>[], existingPhones: string[]): CustomerImportRow[] {
  const known = new Set(existingPhones.map(p => p.trim()));
  const seen = new Set<string>();
  return raw.map((r, i) => {
    const name = pick(r, ['name', 'customer name', 'customer']);
    const phone = pick(r, ['phone', 'phone number', 'mobile', 'contact']);
    const errors: string[] = [];
    if (!name) errors.push('Name missing');
    if (!phone) errors.push('Phone missing');
    else if (known.has(phone)) errors.push('Phone already saved');
    else if (seen.has(phone)) errors.push('Duplicate phone in file');
    if (phone) seen.add(phone);
    return { row: i + 2, name, phone, errors };
  });
}
