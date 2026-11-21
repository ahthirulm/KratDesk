import { describe, expect, it } from 'vitest';
import { mapRestoreMetals, buildRestorePlans } from '@/lib/restore-plan';
import type { BackupFile } from '@/lib/backup';

const backup = (tables: BackupFile['tables']): BackupFile => ({ app: 'KaratDesk', created_at: '2026-11-19T01:43:38.214Z', tables });

describe('cross-installation restore', () => {
  it('maps saved rates and stock to the existing metal IDs without changing amounts', () => {
    const result = mapRestoreMetals(backup({ metal_types: [{ id: 'old-22', name: '22K Gold' }], daily_rates: [{ date: '2026-11-17', metal_id: 'old-22', rate_per_gram: 30000 }], items: [{ id: 'piece', metal_id: 'old-22', weight: 10.5 }] }), [{ id: 'new-22', name: '22K Gold' }]);
    expect(result.tables['daily_rates']).toEqual([{ date: '2026-11-17', metal_id: 'new-22', rate_per_gram: 30000 }]);
    expect(result.tables['items']).toEqual([{ id: 'piece', metal_id: 'new-22', weight: 10.5 }]);
  });
  it('rejects unmatched metals before any write', () => {
    expect(() => mapRestoreMetals(backup({ daily_rates: [{ metal_id: 'unknown', rate_per_gram: 30000 }] }), [{ id: 'new-22', name: '22K Gold' }])).toThrow('No records were changed');
  });
  it('keeps shop-wide tables untouched during a single-branch restore', () => {
    const plans = buildRestorePlans(backup({ customers: [{ id: 'saved' }] }), backup({ customers: [{ id: 'current' }] }), ['B1'], false);
    expect(plans.find(plan => plan.table === 'customers')).toEqual({ table: 'customers', column: 'id', values: [], clearAll: false, rows: [] });
  });
  it('removes existing child records even when the backup has no replacement children', () => {
    const plans = buildRestorePlans(backup({ sales: [] }), backup({ sales: [{ id: 'sale-old', branch_id: 'B1' }], sale_items: [{ id: 'line-old', sale_id: 'sale-old' }] }), ['B1'], false);
    expect(plans.find(plan => plan.table === 'sale_items')?.values).toEqual(['sale-old']);
  });
});