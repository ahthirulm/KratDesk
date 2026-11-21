import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { remainingInactivityMs } from '@/lib/security-rules';
import { usePos } from './data';

export const LAST_ACTIVITY_KEY = 'jewellery-pos-last-activity';

export function SessionSecurity() {
  const { data } = usePos();
  const navigate = useNavigate();
  const client = useQueryClient();
  const userId = data.user?.id;
  const minutes = data.settings.inactivity_minutes;

  useEffect(() => {
    if (!userId) return;
    let lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    const now = Date.now();
    if (!Number.isFinite(lastActivity) || lastActivity <= 0 || lastActivity > now) {
      lastActivity = now;
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
    let timer: ReturnType<typeof setTimeout>;
    let expiring = false;
    let lastWrite = 0;

    const expire = async () => {
      if (expiring) return;
      expiring = true;
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      await client.cancelQueries();
      client.clear();
      await supabase.auth.signOut();
      toast.info('Signed out after a period of inactivity');
      await navigate({ to: '/auth', replace: true, search: { reason: 'timeout' } });
    };
    const check = () => {
      const remaining = remainingInactivityMs(lastActivity, Date.now(), minutes);
      if (remaining === 0) {
        void expire();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(check, Math.min(remaining + 50, 2_147_000_000));
    };
    const activity = () => {
      const timestamp = Date.now();
      lastActivity = timestamp;
      if (timestamp - lastWrite > 10_000) {
        lastWrite = timestamp;
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
      }
      check();
    };
    const syncActivity = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY) return;
      const timestamp = Number(event.newValue);
      if (Number.isFinite(timestamp) && timestamp > 0) {
        lastActivity = timestamp;
        check();
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener('storage', syncActivity);
    document.addEventListener('visibilitychange', visibility);
    check();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener('storage', syncActivity);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [client, minutes, navigate, userId]);

  return null;
}
