import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { runtimeSupabaseConfig } from './runtime-config';

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isOpaqueApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  const { supabaseUrl, supabasePublishableKey } = runtimeSupabaseConfig;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('KaratDesk runtime settings are missing the public backend URL or publishable key');
  }
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: { fetch: createSupabaseFetch(supabasePublishableKey) },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

let client: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!client) client = createSupabaseClient();
    return Reflect.get(client, prop, receiver);
  },
});
