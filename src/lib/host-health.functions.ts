import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { APP_VERSION } from './version';

type HostMetrics = {
  model: string | null; os: string | null; dataDir: string; uptime: number;
  cpuLoad: number; cores: number; ram: number; ramAvailable: number | null;
  disk: number | null; diskFree: number | null;
  battery: { present: boolean; capacity: number | null; state: string | null; charger: string | null } | null;
};

export const getHostHealth = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{version: string; provider: string | null; region: string | null; host: HostMetrics | null}> => {
    const { data, error } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    });
    if (error || !data) throw new Error('Super Admin access required');

    const info = {
      version: APP_VERSION,
      provider: process.env["KD_HOST_PROVIDER"] || null,
      region: process.env["KD_HOST_REGION"] || null,
    };
    // Cloud has no VPS hardware; device and database health remain available in the UI.
    return { ...info, host: null };
  });
