// Server-only: builds a full backup and emails it through Resend.
import { BACKUP_TABLES } from '@/lib/backup';
import { encryptBackup } from '@/lib/backup-crypto';
import { nextRunAfterRun } from '@/lib/backup-schedule';

const MAX_ATTACHMENT = 30 * 1024 * 1024;
type Loose = { from: (t: string) => any };

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export async function resendFetch(apiKey: string, path: string, init?: RequestInit) {
  const connectionKey = process.env['RESEND_API_KEY'];
  const gatewayKey = process.env['LOVABLE_API_KEY'];
  if (!connectionKey || !gatewayKey) throw new Error('Connect Resend before sending email');
  const res = await fetch(`https://connector-gateway.lovable.dev/resend${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${gatewayKey}`, 'X-Connection-Api-Key': connectionKey, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `Email service error ${res.status}`);
  return body as any;
}

export async function runScheduledBackup(trigger: 'schedule' | 'manual' | 'test') {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const db = supabaseAdmin as unknown as Loose;
  const { data: s } = await db.from('backup_schedule').select('*').eq('id', 1).maybeSingle();
  if (!s) throw new Error('Backup schedule is not set up yet');
  const now = new Date();
  let records = 0, size = 0;
  try {
    if (!process.env['RESEND_API_KEY']) throw new Error('Add the email service key first');
    if (!s.from_email) throw new Error('Add the sender email first');
    if (!s.recipients?.length) throw new Error('Add at least one recipient');
    if (s.encrypt && !s.encrypt_password) throw new Error('Set a backup password or turn encryption off');
    let attachments: { filename: string; content: string }[] = [];
    if (trigger !== 'test') {
      const tables: Record<string, unknown[]> = {};
      for (const t of BACKUP_TABLES) {
        const rows: unknown[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from(t).select('*').range(from, from + 999);
          if (error) throw new Error(`${t}: ${error.message}`);
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        tables[t] = rows; records += rows.length;
      }
      const { data: br } = await db.from('branches').select('id');
      let contents = JSON.stringify({ app: 'KaratDesk', created_at: now.toISOString(), branches: (br || []).map((b: { id: string }) => b.id), tables });
      if (s.encrypt) contents = await encryptBackup(contents, s.encrypt_password);
      size = contents.length;
      if (size > MAX_ATTACHMENT) throw new Error('Backup is larger than 30 MB and cannot be emailed; download it from Import / export');
      const day = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
      attachments = [{ filename: `karatdesk-backup-${day}${s.encrypt ? '-encrypted' : ''}.json`, content: toBase64Utf8(contents) }];
    }
    const when = now.toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
    await resendFetch(s.api_key, '/emails', {
      method: 'POST',
      body: JSON.stringify({
        from: `${s.from_name || 'KaratDesk Backup'} <${s.from_email}>`,
        to: s.recipients,
        subject: trigger === 'test' ? 'KaratDesk backup email test' : `KaratDesk backup · ${when}`,
        text: trigger === 'test'
          ? 'Scheduled backup emails are working.'
          : `Attached is the full KaratDesk backup taken ${when} (Colombo) with ${records} records.${s.encrypt ? ' It is encrypted with the backup password.' : ''} Restore it from Administration → Backup & restore.`,
        attachments,
      }),
    });
    if (trigger !== 'test') await db.from('backup_schedule').update({ last_run_at: now.toISOString(), last_status: 'sent', last_error: null, next_run_at: trigger === 'schedule' || s.enabled ? nextRunAfterRun(now, s.every_days, s.run_hour).toISOString() : s.next_run_at }).eq('id', 1);
    await db.from('backup_runs').insert({ trigger, status: 'sent', records, size_bytes: size, recipients: s.recipients });
    return { records, size };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Backup failed';
    if (trigger === 'schedule') await db.from('backup_schedule').update({ last_run_at: now.toISOString(), last_status: 'failed', last_error: message, next_run_at: nextRunAfterRun(now, 1, s.run_hour).toISOString() }).eq('id', 1);
    await db.from('backup_runs').insert({ trigger, status: 'failed', records, size_bytes: size, recipients: s.recipients || [], error: message });
    throw new Error(message);
  }
}
