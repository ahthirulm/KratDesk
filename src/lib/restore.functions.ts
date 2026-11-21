import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { RESTORE_ORDER, type BackupFile } from '@/lib/backup';
import { buildRestorePlans, mapRestoreMetals } from '@/lib/restore-plan';
import type { Database, Json } from '@/integrations/supabase/types';

const MAX_ROWS = 200000;

type RestoreInput = {
  created_at: string;
  branches: string[];
  tables: Record<string, Record<string, unknown>[]>;
};

/**
 * Puts a backup file back into the shop. Only the owner may run it: it clears the
 * chosen branches first, then writes the saved rows back in dependency order.
 * Logins, branches, shop settings and metal types are never touched.
 */
export const restoreBackup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RestoreInput) => {
    if (!input || typeof input !== 'object') throw new Error('Choose a backup file first');
    if (!Array.isArray(input.branches) || input.branches.length === 0) throw new Error('Choose at least one branch to restore');
    if (!input.tables || typeof input.tables !== 'object') throw new Error('This file has no shop records');
    const rows = Object.values(input.tables).reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);
    if (rows === 0) throw new Error('This file has no shop records');
    if (rows > MAX_ROWS) throw new Error('This backup is too large to restore in one go');
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!isOwner) throw new Error('Only the shop owner can restore a backup');

    const { data: branchRows } = await context.supabase.from('branches').select('id');
    const known = new Set((branchRows || []).map((branch) => branch.id));
    if (!data.branches.every((id) => known.has(id))) throw new Error('This backup refers to a branch that no longer exists');
    const everyBranch = data.branches.length === known.size;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: metals, error: metalError } = await supabaseAdmin.from('metal_types').select('id,name');
    if (metalError) throw new Error('Could not check the metal directory. No records were changed.');
    const file = mapRestoreMetals({ app: 'KaratDesk', created_at: data.created_at, tables: data.tables }, metals || []);
    const current: BackupFile = { app: 'KaratDesk', created_at: data.created_at, tables: {} };
    // Current child IDs, not saved child IDs, determine what must be replaced.
    for (const spec of RESTORE_ORDER) {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const table = spec.table as keyof Database['public']['Tables'];
        const { data: page, error } = await supabaseAdmin.from(table).select('*').range(from, from + 999);
        if (error) throw new Error('Could not prepare restore. No records were changed.');
        rows.push(...(page || []) as Record<string, unknown>[]);
        if (!page || page.length < 1000) break;
      }
      current.tables[spec.table] = rows;
    }
    const plans = buildRestorePlans(file, current, data.branches, everyBranch);
    const payload: Json = JSON.parse(JSON.stringify(plans));
    const { data: total, error } = await supabaseAdmin.rpc('kd_restore_records', { p_plans: payload, p_actor: context.userId, p_aal: String((context.claims as { aal?: string })?.aal || 'aal1') });
    if (error) throw new Error('Restore was cancelled; no records were changed. ' + error.message);
    return { restored: total, everyBranch };
  });
