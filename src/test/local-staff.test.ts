import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { createLocalStaff } from '@/lib/local-staff.server';

const input = { name: 'Ahamed', username: ' Ahamed ', password: 'Counter1234', roleId: 'cashier-role', branchIds: ['B1'], active: true };
function clients(accessError: object | null = null, branches = [{ id: 'B1' }]) {
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: 'local-staff-id' } }, error: null });
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: accessError });
  const from = vi.fn((table: string) => {
    const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: { id: 'cashier-role' }, error: null }), in: async () => ({ data: branches, error: null }) };
    if (table !== 'staff_roles' && table !== 'branches') throw new Error('Unexpected table');
    return chain;
  });
  return { actor: { from, rpc } as unknown as SupabaseClient<Database>, privileged: { auth: { admin: { createUser, deleteUser } } } as unknown as SupabaseClient<Database>, createUser, deleteUser, rpc };
}

describe('local staff login without email', () => {
  it('creates a password login without a contact email or invitation', async () => {
    const c = clients();
    await expect(createLocalStaff(input, c.actor, c.privileged)).resolves.toEqual({ id: 'local-staff-id' });
    expect(c.createUser).toHaveBeenCalledWith({ email: 'ahamed@app.local', password: 'Counter1234', email_confirm: true, user_metadata: { display_name: 'Ahamed', username: 'ahamed' } });
    expect(c.rpc).toHaveBeenCalledWith('save_staff_access', { p: { user_id: 'local-staff-id', role_id: 'cashier-role', display_name: 'Ahamed', branch_ids: ['B1'], active: true } });
  });
  it('rejects an unavailable branch before creating a login', async () => {
    const c = clients(null, []);
    await expect(createLocalStaff(input, c.actor, c.privileged)).rejects.toThrow('Select active branches');
    expect(c.createUser).not.toHaveBeenCalled();
  });
  it('removes the new login if server-enforced access assignment fails', async () => {
    const c = clients({ message: 'Forbidden' });
    await expect(createLocalStaff(input, c.actor, c.privileged)).rejects.toThrow('No user login was saved');
    expect(c.deleteUser).toHaveBeenCalledWith('local-staff-id');
  });
});