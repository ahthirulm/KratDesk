import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { APP_VERSION } from './version';

export const getHostHealth = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    if (process.env["KD_SELF_HOSTED"] !== '1') return { ...info, host: null };

    const os = await import('node:os');
    const fs = await import('node:fs/promises');
    const read = (f: string) => fs.readFile(f, 'utf8').then((v) => v.trim()).catch(() => null);
    const dataDir = process.env['KD_DATA_DIR'] || process.cwd();
    const [release, disk, meminfo, model] = await Promise.all([
      fs.readFile('/etc/os-release', 'utf8').catch(() => ''),
      fs.statfs(dataDir).catch(() => null),
      fs.readFile('/proc/meminfo', 'utf8').catch(() => ''),
      read('/sys/class/dmi/id/product_name'),
    ]);
    let battery: { present: boolean; capacity: number | null; state: string | null; charger: string | null } | null = null;
    try {
      const base = '/sys/class/power_supply';
      const names = await fs.readdir(base);
      let present = false, capacity: number | null = null, state: string | null = null, charger: string | null = null;
      for (const n of names) {
        const type = await read(`${base}/${n}/type`);
        if (type === 'Battery') {
          present = true;
          const c = await read(`${base}/${n}/capacity`);
          capacity = c != null && c !== '' && !isNaN(Number(c)) ? Number(c) : null;
          state = await read(`${base}/${n}/status`);
        } else if (type === 'Mains' || type === 'USB') {
          const online = await read(`${base}/${n}/online`);
          if (online === '1') charger = 'Plugged in';
          else if (online === '0' && charger !== 'Plugged in') charger = 'Unplugged';
        }
      }
      battery = { present, capacity, state, charger };
    } catch {
      battery = null;
    }
    const average = os.loadavg();
    const memoryAvailable = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    return {
      ...info,
      host: {
        model: model || null,
        battery,
        dataDir,
        os: release.match(/^PRETTY_NAME="?([^"\n]+)"?$/m)?.[1] || null,
        uptime: os.uptime(),
        cpuLoad: average[0] ?? 0,
        cores: os.cpus().length,
        ram: os.totalmem(),
        ramAvailable: memoryAvailable ? Number(memoryAvailable[1]) * 1024 : null,
        disk: disk ? disk.bsize * disk.blocks : null,
        diskFree: disk ? disk.bsize * disk.bavail : null,
      },
    };
  });
