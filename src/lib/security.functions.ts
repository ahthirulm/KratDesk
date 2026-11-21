import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { internalLoginEmail, normalizeUsername, validatePassword } from './security-rules';

type SetupInput = { shopName: string; ownerName: string; email: string; username: string; password: string };
type CreateStaffInput = {
  name: string;
  username: string;
  password: string;
  roleId: string;
  branchIds: string[];
  active: boolean;
};

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error || !data) throw new Error('Owner access required');
}

export const getInstallationStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
  if (error) throw new Error('Installation status is unavailable');
  return { needsSetup: !data?.length };
});

export const setupSuperAdmin = createServerFn({ method: 'POST' })
  .inputValidator((input: SetupInput) => input)
  .handler(async ({ data }) => {
    const username = normalizeUsername(data.username);
    const password = validatePassword(data.password);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@app.local')) {
      throw new Error('Enter a valid email address');
    }
    const ownerName = data.ownerName.trim();
    const shopName = data.shopName.trim();
    if (!ownerName || ownerName.length > 100 || !shopName || shopName.length > 120) {
      throw new Error('Enter a shop name and owner name');
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: owners, error: statusError } = await supabaseAdmin.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
    if (statusError) throw new Error('Installation status is unavailable');
    if (owners?.length) throw new Error('Setup is already complete. Login instead.');

    const created = await supabaseAdmin.auth.admin.createUser({
      email: internalLoginEmail(username),
      password,
      email_confirm: true,
      user_metadata: { display_name: ownerName, username },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message.includes('already') ? 'This username is already in use' : 'Could not create the owner account');
    }

    const userId = created.data.user.id;
    const { error: contactError } = await (supabaseAdmin as any)
      .from('kd_account_contacts').insert({ user_id: userId, email });
    if (contactError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Could not save the owner email. Please retry setup.');
    }
    const completed = await supabaseAdmin.rpc('complete_owner_setup', {
      p_user_id: userId,
      p_shop_name: shopName,
      p_owner_name: ownerName,
      p_username: username,
    });
    if (completed.error) {
      await (supabaseAdmin as any).from('kd_account_contacts').delete().eq('user_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Setup could not be completed. No owner was saved; please try again.');
    }
    return { ok: true as const };
  });

export const createStaffAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateStaffInput) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc('is_admin');
    if (error || !allowed) throw new Error('Admin access required');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { createLocalStaff } = await import('./local-staff.server');
    return createLocalStaff(data, context.supabase, supabaseAdmin);
  });

export const resetStaffPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const password = validatePassword(data.password);
    const { data: target, error: targetError } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.userId)
      .maybeSingle();
    if (targetError || !target) throw new Error('Staff account not found');
    if (target.role === 'admin') throw new Error('Owner passwords must be changed from the owner profile');

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const updated = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (updated.error) throw new Error('Could not reset the staff password');
    const audited = await context.supabase.rpc('log_security_action', { p_user_id: data.userId, p_action: 'Password reset' });
    if (audited.error) throw new Error('Password was reset, but the audit entry could not be saved');
    return { ok: true as const };
  });
