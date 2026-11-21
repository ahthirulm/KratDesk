import { createFileRoute } from '@tanstack/react-router';

// Public browser bootstrap only. The service-role key and cron secret are never read here.
export const Route = createFileRoute('/api/public/runtime-config')({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env['SUPABASE_PUBLIC_URL']?.trim() || process.env['SUPABASE_URL']?.trim();
        const supabasePublishableKey = process.env['SUPABASE_PUBLISHABLE_KEY']?.trim();
        if (!supabaseUrl || !supabasePublishableKey) {
          return Response.json({ error: 'Public runtime configuration is unavailable' }, { status: 503 });
        }
        return Response.json(
          { supabaseUrl, supabasePublishableKey },
          {
            headers: {
              'cache-control': 'no-store, max-age=0',
              'x-content-type-options': 'nosniff',
            },
          },
        );
      },
    },
  },
});
