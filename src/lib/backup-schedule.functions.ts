import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { nextSlotAfter, validEmail } from '@/lib/backup-schedule';

async function ownerOnly(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!data) throw new Error('Only the owner can manage scheduled backups');
}
async function load() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const db = supabaseAdmin as any;
  const { data } = await db.from('backup_schedule').select('*').eq('id', 1).maybeSingle();
  return { db, s: data ? { ...data, api_key: process.env['RESEND_API_KEY'] ? 'connected' : null } : null };
}

export type ScheduleView = {
  enabled: boolean; every_days: number; run_hour: number; recipients: string[]; from_name: string; from_email: string;
  email_domain: string; domain_status: string; has_api_key: boolean; encrypt: boolean; has_password: boolean;
  next_run_at: string | null; last_run_at: string | null; last_status: string | null; last_error: string | null;
  dns: { type: string; name: string; value: string; status?: string }[];
  runs: { id: string; started_at: string; trigger: string; status: string; records: number; size_bytes: number; error: string | null }[];
};

export const getBackupSchedule = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await ownerOnly(context);
  const { db, s } = await load();
  let dns: ScheduleView['dns'] = [];
  if (s?.api_key && s?.resend_domain_id) {
    try {
      const { resendFetch } = await import('@/lib/scheduled-backup.server');
      const d = await resendFetch(s.api_key, `/domains/${s.resend_domain_id}`);
      dns = (d.records || []).map((r: any) => ({ type: r.type, name: r.name, value: r.value, status: r.status }));
      if (d.status && d.status !== s.domain_status) await db.from('backup_schedule').update({ domain_status: d.status }).eq('id', 1);
      s.domain_status = d.status || s.domain_status;
    } catch { /* show stored status */ }
  }
  const { data: runs } = await db.from('backup_runs').select('id,started_at,trigger,status,records,size_bytes,error').order('started_at', { ascending: false }).limit(15);
  const v: ScheduleView = {
    enabled: !!s?.enabled, every_days: s?.every_days ?? 2, run_hour: s?.run_hour ?? 2, recipients: s?.recipients ?? [],
    from_name: s?.from_name ?? 'KaratDesk Backup', from_email: s?.from_email ?? '', email_domain: s?.email_domain ?? '',
    domain_status: s?.domain_status ?? 'not added', has_api_key: !!s?.api_key, encrypt: s?.encrypt ?? true, has_password: !!s?.encrypt_password,
    next_run_at: s?.next_run_at ?? null, last_run_at: s?.last_run_at ?? null, last_status: s?.last_status ?? null, last_error: s?.last_error ?? null,
    dns, runs: runs || [],
  };
  return v;
});

type SaveInput = { enabled: boolean; every_days: number; run_hour: number; recipients: string[]; from_name: string; from_email: string; encrypt: boolean; api_key?: string | undefined; encrypt_password?: string | undefined };
export const saveBackupSchedule = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: SaveInput) => {
    if (!Number.isInteger(i.every_days) || i.every_days < 1 || i.every_days > 30) throw new Error('Choose every 1 to 30 days');
    if (!Number.isInteger(i.run_hour) || i.run_hour < 0 || i.run_hour > 23) throw new Error('Choose a valid time');
    if (!Array.isArray(i.recipients) || i.recipients.length > 10 || !i.recipients.every(validEmail)) throw new Error('Check the recipient emails (up to 10)');
    if (i.from_email && !validEmail(i.from_email)) throw new Error('Check the sender email');
    if (i.encrypt_password && i.encrypt_password.length < 8) throw new Error('Backup password needs at least 8 characters');
    return i;
  })
  .handler(async ({ data, context }) => {
    await ownerOnly(context);
    const { db, s } = await load();
    const row: Record<string, unknown> = {
      id: 1, enabled: data.enabled, every_days: data.every_days, run_hour: data.run_hour, recipients: data.recipients,
      from_name: data.from_name.slice(0, 60) || 'KaratDesk Backup', from_email: data.from_email.trim().toLowerCase(), encrypt: data.encrypt, updated_at: new Date().toISOString(),
    };
    // Provider credentials are managed by the connected service, never saved in app records.
    if (data.encrypt_password) row['encrypt_password'] = data.encrypt_password;
    const changedTiming = !s || s.run_hour !== data.run_hour || s.every_days !== data.every_days || (!s.enabled && data.enabled) || !s.next_run_at;
    if (data.enabled && changedTiming) row['next_run_at'] = nextSlotAfter(new Date(), data.run_hour).toISOString();
    if (!data.enabled) row['next_run_at'] = null;
    const merged = { ...(s || {}), ...row, api_key: process.env['RESEND_API_KEY'] ? 'connected' : null } as any;
    if (data.enabled && (!merged.api_key || !merged.from_email || !merged.recipients.length || (merged.encrypt && !merged.encrypt_password))) throw new Error('Fill in email service key, sender, recipients and backup password before turning on');
    const { error } = await db.from('backup_schedule').upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addBackupDomain = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: { domain: string }) => { const d = (i.domain || '').trim().toLowerCase(); if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new Error('Enter a domain like yourshop.lk'); return { domain: d }; })
  .handler(async ({ data, context }) => {
    await ownerOnly(context);
    const { db, s } = await load();
    if (!s?.api_key) throw new Error('Save the email service key first');
    const { resendFetch } = await import('@/lib/scheduled-backup.server');
    const list = await resendFetch(s.api_key, '/domains');
    let d = (list.data || []).find((x: any) => x.name === data.domain);
    if (!d) d = await resendFetch(s.api_key, '/domains', { method: 'POST', body: JSON.stringify({ name: data.domain }) });
    await db.from('backup_schedule').update({ email_domain: data.domain, resend_domain_id: d.id, domain_status: d.status || 'pending', from_email: s.from_email || `backup@${data.domain}` }).eq('id', 1);
    return { ok: true };
  });

export const verifyBackupDomain = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await ownerOnly(context);
  const { s } = await load();
  if (!s?.api_key || !s?.resend_domain_id) throw new Error('Add a domain first');
  const { resendFetch } = await import('@/lib/scheduled-backup.server');
  await resendFetch(s.api_key, `/domains/${s.resend_domain_id}/verify`, { method: 'POST' });
  return { ok: true };
});

export const runBackupNow = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: { test: boolean }) => ({ test: !!i?.test }))
  .handler(async ({ data, context }) => {
    await ownerOnly(context);
    const { runScheduledBackup } = await import('@/lib/scheduled-backup.server');
    return runScheduledBackup(data.test ? 'test' : 'manual');
  });
