import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Mail, Send, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Field } from './shared';
import { Fold } from './fold';
import { PasswordInput } from './password-input';
import { getBackupSchedule, saveBackupSchedule, addBackupDomain, verifyBackupDomain, runBackupNow } from '@/lib/backup-schedule.functions';
import { parseRecipients } from '@/lib/backup-schedule';

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
const colombo = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function ScheduledBackup() {
  const qc = useQueryClient();
  const get = useServerFn(getBackupSchedule), save = useServerFn(saveBackupSchedule), addDomain = useServerFn(addBackupDomain), verify = useServerFn(verifyBackupDomain), run = useServerFn(runBackupNow);
  const q = useQuery({ queryKey: ['backup-schedule'], queryFn: () => get() });
  const s = q.data;
  const [f, setF] = useState({ enabled: false, every_days: 2, run_hour: 2, recipients: '', from_name: '', from_email: '', encrypt: true, api_key: '', encrypt_password: '', domain: '' });
  const [busy, setBusy] = useState('');
  useEffect(() => { if (s) setF((p) => ({ ...p, enabled: s.enabled, every_days: s.every_days, run_hour: s.run_hour, recipients: s.recipients.join(', '), from_name: s.from_name, from_email: s.from_email, encrypt: s.encrypt, domain: s.email_domain, api_key: '', encrypt_password: '' })); }, [s]);
  const act = async (name: string, fn: () => Promise<unknown>, ok: string) => { setBusy(name); try { await fn(); toast.success(ok); await qc.invalidateQueries({ queryKey: ['backup-schedule'] }); } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(''); } };
  const doSave = (enabled = f.enabled) => act('save', () => save({ data: { enabled, every_days: f.every_days, run_hour: f.run_hour, recipients: parseRecipients(f.recipients), from_name: f.from_name, from_email: f.from_email, encrypt: f.encrypt, api_key: f.api_key || undefined, encrypt_password: f.encrypt_password || undefined } }), enabled ? 'Scheduled backups saved' : 'Scheduled backups saved (off)');
  if (q.isLoading) return <section className="dashboard-section"><p>Loading scheduled backups…</p></section>;
  if (q.error) return null;
  const verified = s?.domain_status === 'verified';
  return <Fold icon={<Mail />} title="Scheduled email backup" note="Owner only. Emails a full all-branch backup automatically." actions={<><span>{f.enabled ? 'On' : 'Off'}</span><Switch checked={f.enabled} disabled={!!busy} onCheckedChange={(v) => { setF({ ...f, enabled: v }); doSave(v); }} /></>}>
      <Fold sub defaultOpen title="1. Timing"><div className="space-y-3">
        <Field label="Repeat every (days)"><Input type="number" min={1} max={30} value={f.every_days} onChange={(e) => setF({ ...f, every_days: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} /></Field>
        <Field label="Time (Colombo)"><select className="h-10 w-full rounded-md border bg-background px-3" value={f.run_hour} onChange={(e) => setF({ ...f, run_hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
        <Field label="Send to (emails, comma separated)"><Textarea rows={2} value={f.recipients} onChange={(e) => setF({ ...f, recipients: e.target.value })} placeholder="owner@yourshop.lk" /></Field>
      </div></Fold>
      <Fold sub title="2. Protection"><div className="space-y-3">
        <div className="flex items-center gap-2"><Switch checked={f.encrypt} onCheckedChange={(v) => setF({ ...f, encrypt: v })} /><span>Encrypt backup file (recommended)</span></div>
        {f.encrypt && <Field label={s?.has_password ? 'Backup password (saved — type to change)' : 'Backup password (min 8)'}><PasswordInput value={f.encrypt_password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, encrypt_password: e.target.value })} /></Field>}
        <p className="text-sm text-muted-foreground">You need this password to restore. Keep it safe — it cannot be recovered.</p>
      </div></Fold>
      <Fold sub title="3. Email sending"><div className="space-y-3">
        <Field label={s?.has_api_key ? 'Resend API key (saved — paste to replace)' : 'Resend API key'}><PasswordInput value={f.api_key} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, api_key: e.target.value })} placeholder="re_..." /></Field>
        <p className="text-sm text-muted-foreground">Create a free key at resend.com → API keys, then Save.</p>
        <Field label="Your domain"><div className="flex gap-2"><Input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="yourshop.lk" /><Button variant="outline" disabled={!!busy || !s?.has_api_key} onClick={() => act('domain', () => addDomain({ data: { domain: f.domain } }), 'Domain added — add the records below')}>Add</Button></div></Field>
        {s?.email_domain && <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between"><span>{s.email_domain}</span><Badge variant={verified ? 'default' : 'secondary'}>{s.domain_status}</Badge></div>
          {!verified && s.dns.length > 0 && <><p className="text-sm">Add these records at your domain provider, then press Check:</p>
            <div className="space-y-1 text-xs">{s.dns.map((r, i) => <div key={i} className="grid grid-cols-[3rem_1fr_auto] gap-2 items-center border-t pt-1"><b>{r.type}</b><span className="break-all">{r.name} → {r.value}</span><Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(r.value); toast.success('Copied'); }}><Copy /></Button></div>)}</div></>}
          {!verified && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('verify', () => verify(), 'Checking domain — refresh in a minute')}><RefreshCw />Check domain</Button>}
        </div>}
        <Field label="Sender name"><Input value={f.from_name} onChange={(e) => setF({ ...f, from_name: e.target.value })} /></Field>
        <Field label="Sender email"><Input value={f.from_email} onChange={(e) => setF({ ...f, from_email: e.target.value })} placeholder="backup@yourshop.lk" /></Field>
      </div></Fold>
    <div className="flex flex-wrap gap-2 pt-4">
      <Button disabled={!!busy} onClick={() => doSave()}>{busy === 'save' ? 'Saving…' : 'Save settings'}</Button>
      <Button variant="outline" disabled={!!busy || !verified} onClick={() => act('test', () => run({ data: { test: true } }), 'Test email sent')}><Send />Send test email</Button>
      <Button variant="outline" disabled={!!busy || !verified} onClick={() => act('now', () => run({ data: { test: false } }), 'Backup emailed')}><Mail />{busy === 'now' ? 'Sending backup…' : 'Send backup now'}</Button>
    </div>
    <div className="grid gap-2 pt-4 text-sm md:grid-cols-3">
      <div>Next backup: <b>{s?.enabled ? colombo(s.next_run_at) : 'Off'}</b></div>
      <div>Last backup: <b>{colombo(s?.last_run_at ?? null)}</b> {s?.last_status && <Badge variant={s.last_status === 'sent' ? 'default' : 'destructive'}>{s.last_status}</Badge>}</div>
      {s?.last_error && <div className="text-destructive">{s.last_error}</div>}
    </div>
    {!!s?.runs.length && <div className="pt-3"><Fold sub title="History"><div className="text-sm divide-y">{s.runs.map((r) => <div key={r.id} className="flex flex-wrap gap-3 py-1"><span>{colombo(r.started_at)}</span><span>{r.trigger}</span><Badge variant={r.status === 'sent' ? 'default' : 'destructive'}>{r.status}</Badge>{r.records > 0 && <span>{r.records.toLocaleString()} records · {(r.size_bytes / 1048576).toFixed(1)} MB</span>}{r.error && <span className="text-destructive">{r.error}</span>}</div>)}</div></Fold></div>}
  </Fold>;
}
