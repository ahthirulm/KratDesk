import { createClient } from '@supabase/supabase-js';
import { runtimeBackend } from './public-backend';
import { browserSupabaseUrl } from './runtime-config';

// Self-hosted builds learn the backend address at runtime; never trust build-time placeholders here.
async function backendConfig(): Promise<{ url: string; key: string } | null> {
  try {
    const res = await fetch('/api/public/runtime-config', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (res.ok) {
      const p = (await res.json()) as { supabaseUrl?: string; supabasePublishableKey?: string };
      if (p.supabaseUrl && p.supabasePublishableKey) {
        return { url: browserSupabaseUrl(p.supabaseUrl, window.location.origin), key: p.supabasePublishableKey };
      }
    }
  } catch { /* fall back below */ }
  const legacy = runtimeBackend();
  if (legacy?.url && legacy.key) {
    return { url: browserSupabaseUrl(legacy.url, window.location.origin), key: legacy.key };
  }
  const url = import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  return url && key ? { url, key } : null;
}

export async function verifyStaffPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;
  const cfg = await backendConfig();
  if (!cfg) throw new Error('Could not reach the sign-in service. Try again.');
  const probe = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) return true;
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) return false;
  throw new Error(error.message || 'Could not check your password. Try again.');
}
