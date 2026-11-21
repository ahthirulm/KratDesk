import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { isDue } from '@/lib/backup-schedule';

export const Route = createFileRoute('/api/public/jobs/scheduled-backup')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const {refreshGold}=await import('@/lib/gold-rates.server');
        await refreshGold().catch(()=>undefined);
        const { data: s } = await (supabaseAdmin as any).from('backup_schedule').select('enabled,next_run_at').eq('id', 1).maybeSingle();
        if (!s || !isDue(new Date(), s.next_run_at, s.enabled)) return Response.json({ skipped: true });
        const { runScheduledBackup } = await import('@/lib/scheduled-backup.server');
        try { const r = await runScheduledBackup('schedule'); return Response.json({ sent: true, ...r }); }
        catch (e) { return Response.json({ sent: false, error: e instanceof Error ? e.message : 'failed' }); }
      },
    },
  },
});
