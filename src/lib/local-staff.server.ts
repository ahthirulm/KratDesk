import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { internalLoginEmail, normalizeUsername, validatePassword } from './security-rules';

export type LocalStaffInput = {
  name: string;
  username: string;
  password: string;
  roleId: string;
  branchIds: string[];
  active: boolean;
};

// The caller must authorize the administrator before passing either client.
export async function createLocalStaff(
  input: LocalStaffInput,
  actor: SupabaseClient<Database>,
  privileged: SupabaseClient<Database>,
) {
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error('Enter a staff name');
  const branchIds = [...new Set(input.branchIds)];
  if (!branchIds.length) throw new Error('Select at least one branch');

  const { data: role, error: roleError } = await actor.from('staff_roles')
    .select('id').eq('id', input.roleId).single();
  if (roleError || !role) throw new Error('Select a valid staff role');
  const { data: branches, error: branchError } = await actor.from('branches')
    .select('id').eq('active', true).in('id', branchIds);
  if (branchError || !branchIds.every(id => branches?.some(branch => branch.id === id))) {
    throw new Error('Select active branches you can manage');
  }

  // This internal address is a credential identifier, not a contact email.
  // No invitation or delivery provider is required for a local login.
  const created = await privileged.auth.admin.createUser({
    email: internalLoginEmail(username),
    password,
    email_confirm: true,
    user_metadata: { display_name: name, username },
  });
  if (created.error || !created.data.user) throw new Error('Could not create user. Check the username is unique.');
  const userId = created.data.user.id;
  const { error: accessError } = await actor.rpc('save_staff_access', {
    p: { user_id: userId, role_id: role.id, display_name: name, branch_ids: branchIds, active: input.active },
  });
  if (accessError) {
    const { error: cleanupError } = await privileged.auth.admin.deleteUser(userId);
    if (cleanupError) throw new Error('Could not assign staff access or remove the unused login. Ask the owner to check User management.');
    throw new Error('Could not assign staff access. No user login was saved.');
  }
  return { id: userId };
}