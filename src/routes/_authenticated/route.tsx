import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

// Cache a passed access check briefly so switching pages doesn't wait on repeated server round-trips.
let accessCache: { userId: string; at: number; mfaPending: boolean; requires2fa: boolean } | null = null;
const ACCESS_TTL_MS = 60_000;
supabase.auth.onAuthStateChange(() => { accessCache = null; });

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const cached = session && accessCache && accessCache.userId === session.user.id && Date.now() - accessCache.at < ACCESS_TTL_MS ? accessCache : null;
    if (cached) {
      if (cached.mfaPending) throw redirect({ to: '/auth', search: { mfa: '1' } });
      if (cached.requires2fa && location.pathname !== '/profile') throw redirect({ to: '/profile', search: { setup2fa: '1' } });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: '/auth' });

    const { data: allowed, error: accessError } = await supabase.rpc('login_access');
    if (accessError || !allowed) {
      await supabase.auth.signOut();
      throw redirect({ to: '/auth' });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('mfa_enabled,two_factor_required')
      .eq('id', user.id)
      .single();
    if (error) {
      await supabase.auth.signOut();
      throw redirect({ to: '/auth' });
    }

    let mfaPending = false;
    if (profile.mfa_enabled) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      mfaPending = aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1';
    }
    accessCache = { userId: user.id, at: Date.now(), mfaPending, requires2fa: profile.two_factor_required && !profile.mfa_enabled };
    if (mfaPending) throw redirect({ to: '/auth', search: { mfa: '1' } });
    if (profile.two_factor_required && !profile.mfa_enabled && location.pathname !== '/profile') {
      throw redirect({ to: '/profile', search: { setup2fa: '1' } });
    }
  },
  component: Outlet,
});
