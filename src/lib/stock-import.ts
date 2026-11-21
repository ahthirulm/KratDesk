export type ImportRow = { tag: string; name: string; metal: string; category: string; weight: number; cost: number; supplier: string };

export function parseStockImport(rows: Record<string, unknown>[], knownTags: string[], metals: string[], categories: string[]) {
  const seen = new Set(knownTags.map((tag) => tag.trim().toLowerCase()));
  return rows.map((row, index) => {
    // v2 templates used "Purchase price (LKR)"; keep them readable after currency labels were hidden.
    const rawCost = row['Purchase price'] ?? row['Purchase price (LKR)'];
    const item: ImportRow = {
      tag: String(row['Internal tag'] ?? '').trim(),
      name: String(row['Item name'] ?? '').trim(),
      metal: String(row['Metal'] ?? '').trim(),
      category: String(row['Category'] ?? '').trim(),
      weight: Number(row['Weight (g)']),
      cost: Number(rawCost),
      supplier: String(row['Supplier'] ?? '').trim(),
    };
    const errors: string[] = [];
    if (!item.tag || !item.name) errors.push('Internal tag and item name are required');
    if (seen.has(item.tag.toLowerCase())) errors.push('Internal tag is already used');
    seen.add(item.tag.toLowerCase());
    if (!metals.includes(item.metal)) errors.push('Metal is not in the directory');
    if (!categories.includes(item.category)) errors.push('Category is not in the directory');
    if (!Number.isFinite(item.weight) || item.weight <= 0 || Math.abs(item.weight * 1000 - Math.round(item.weight * 1000)) > 0.000001) {
      errors.push('Weight must be positive with at most 3 decimals');
    }
    if (rawCost === '' || rawCost == null || !Number.isFinite(item.cost) || item.cost < 0) errors.push('Enter a non-negative purchase price');
    return { row: index + 2, item, errors };
  });
}
