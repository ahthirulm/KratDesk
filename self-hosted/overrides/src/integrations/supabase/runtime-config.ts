import { browserSupabaseUrl } from '@/lib/runtime-config';

export type RuntimeSupabaseConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

async function loadRuntimeSupabaseConfig(): Promise<RuntimeSupabaseConfig> {
  if (typeof window === 'undefined') {
    return {
      supabaseUrl: (process.env['SUPABASE_URL'] || '').replace(/\/+$/, ''),
      supabasePublishableKey: process.env['SUPABASE_PUBLISHABLE_KEY'] || '',
    };
  }

  const response = await fetch('/api/public/runtime-config', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load KaratDesk runtime settings (${response.status})`);
  const payload = await response.json() as Partial<RuntimeSupabaseConfig>;
  if (!payload.supabaseUrl || !payload.supabasePublishableKey) {
    throw new Error('KaratDesk runtime settings are incomplete');
  }
  return {
    supabaseUrl: browserSupabaseUrl(payload.supabaseUrl, window.location.origin),
    supabasePublishableKey: payload.supabasePublishableKey,
  };
}

// Module dependency evaluation waits here, so no auth guard or provider can initialize
// Supabase before the browser has received its public runtime configuration.
export const runtimeSupabaseConfig = await loadRuntimeSupabaseConfig();
