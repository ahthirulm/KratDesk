import { describe, expect, it } from 'vitest';
import { resetReady, RESET_GROUPS } from '@/lib/shop-scope';
import { backupRowsFor, scopedRows, SPEC_BY_TABLE, type BackupFile } from '@/lib/backup';

describe('reset confirmation', () => {
  it('needs the phrase, a password, a branch and a record type', () => {
    expect(resetReady('FACTORY RESET', 'secret123', ['B1'], ['sales'])).toBe(true);
    expect(resetReady('factory reset', 'secret123', ['B1'], ['sales'])).toBe(true);
    expect(resetReady('FACTORY RESET', '', ['B1'], ['sales'])).toBe(false);
    expect(resetReady('RESET', 'secret123', ['B1'], ['sales'])).toBe(false);
    expect(resetReady('FACTORY RESET', 'secret123', [], ['sales'])).toBe(false);
    expect(resetReady('FACTORY RESET', 'secret123', ['B1'], [])).toBe(false);
  });

  it('marks shop-wide groups so the screen can warn before running', () => {
    expect(RESET_GROUPS.find((group) => group.id === 'customers')?.wide).toBe(true);
    expect(RESET_GROUPS.find((group) => group.id === 'sales')?.wide).toBe(false);
  });
});

describe('partial backup', () => {
  const items = [{ id: 'i1', branch_id: 'B1' }, { id: 'i2', branch_id: 'B2' }];
  const costs = [{ item_id: 'i1' }, { item_id: 'i2' }];

  it('keeps only the chosen branch and the lines that belong to it', () => {
    const kept = new Map<string, Set<string>>();
    expect(backupRowsFor('items', items, ['B1'], kept)).toEqual([{ id: 'i1', branch_id: 'B1' }]);
    expect(backupRowsFor('item_costs', costs, ['B1'], kept)).toEqual([{ item_id: 'i1' }]);
  });

  it('keeps shop-wide and sign-in records so the file can still be restored', () => {
    const kept = new Map<string, Set<string>>();
    expect(backupRowsFor('customers', [{ id: 'c1' }], ['B1'], kept)).toEqual([{ id: 'c1' }]);
    expect(backupRowsFor('settings', [{ id: true }], ['B1'], kept)).toEqual([{ id: true }]);
  });
});

describe('restore scope', () => {
  const file: BackupFile = {
    app: 'KaratDesk',
    created_at: '2026-11-17T09:00:00.000Z',
    tables: {
      sales: [{ id: 's1', branch_id: 'B1' }, { id: 's2', branch_id: 'B2' }],
      sale_items: [{ id: 'l1', sale_id: 's1' }, { id: 'l2', sale_id: 's2' }],
      customers: [{ id: 'c1' }],
    },
  };

  it('restores only the chosen branch when one branch is picked', () => {
    const restored = new Map<string, Record<string, unknown>[]>();
    const sales = scopedRows(SPEC_BY_TABLE['sales']!, file, ['B1'], false, restored);
    restored.set('sales', sales);
    expect(sales).toEqual([{ id: 's1', branch_id: 'B1' }]);
    expect(scopedRows(SPEC_BY_TABLE['sale_items']!, file, ['B1'], false, restored)).toEqual([{ id: 'l1', sale_id: 's1' }]);
  });

  it('holds shop-wide records back unless every branch is chosen', () => {
    const restored = new Map<string, Record<string, unknown>[]>();
    expect(scopedRows(SPEC_BY_TABLE['customers']!, file, ['B1'], false, restored)).toEqual([]);
    expect(scopedRows(SPEC_BY_TABLE['customers']!, file, ['B1', 'B2'], true, restored)).toEqual([{ id: 'c1' }]);
  });
});
