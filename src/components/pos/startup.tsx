import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import {
  ArrowRight,
  Building2,
  Gem,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from './shared';
import { usePos } from './data';
import { supabase } from '@/integrations/supabase/client';
import { getInstallationStatus, setupSuperAdmin } from '@/lib/security.functions';
import { internalLoginEmail, normalizeUsername, validatePassword } from '@/lib/security-rules';
import { LAST_ACTIVITY_KEY } from './session-security';

export function Startup() {
  const { refresh } = usePos();
  const navigate = useNavigate();
  const installationStatus = useServerFn(getInstallationStatus);
  const createOwner = useServerFn(setupSuperAdmin);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const checkInstallation = useCallback(async () => {
    setCheckingSetup(true);
    setStatusError('');
    try {
      const status = await installationStatus();
      if (!status.needsSetup) {
        await navigate({ to: '/auth', replace: true });
      }
    } catch {
      setStatusError('We could not check the installation. Check your connection and try again.');
    } finally {
      setCheckingSetup(false);
    }
  }, [installationStatus, navigate]);

  useEffect(() => {
    void checkInstallation();
  }, [checkInstallation]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!ownerName.trim()) throw new Error('Enter the owner name');
      const normalizedUsername = normalizeUsername(username);
      validatePassword(password);
      if (password !== confirmation) throw new Error('The password confirmation does not match');

      await createOwner({
        data: { shopName: 'KaratDesk', ownerName, email, username: normalizedUsername, password },
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: internalLoginEmail(normalizedUsername),
        password,
      });
      if (error) {
        toast.success('Admin account created. Please login with your new credentials.');
        await navigate({ to: '/auth', replace: true });
        return;
      }

      const { data: allowed, error: accessError } = await supabase.rpc('login_access');
      if (accessError || !allowed) {
        await supabase.auth.signOut();
        throw new Error('The admin account was created, but access could not be confirmed. Please login again.');
      }

      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      void refresh();
      toast.success('Admin account created. Now complete your shop setup.');
      await navigate({ to: '/settings', replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the admin account';
      toast.error(message);
      if (message.includes('Setup is already complete')) {
        await navigate({ to: '/auth', replace: true });
      }
    } finally {
      setBusy(false);
      setPassword('');
      setConfirmation('');
    }
  }

  return (
    <div className="startup-page">
      <div className="startup-shell">
        <aside className="startup-intro">
          <div className="startup-brand">
            <span className="startup-brand-icon"><Gem size={27} /></span>
            <div>
              <strong>KaratDesk</strong>
              <span>Jewellery POS &amp; Inventory</span>
            </div>
          </div>

          <div className="startup-intro-copy">
            <div className="startup-kicker"><Sparkles size={15} />FRESH INSTALLATION</div>
            <h1>A considered start for your jewellery business.</h1>
            <p>Create your owner account, then bring your branches, stock and staff into one secure workspace.</p>
          </div>

          <div className="startup-benefits">
            <div className="startup-benefit">
              <span><ShieldCheck size={20} /></span>
              <div><strong>Owner-controlled access</strong><p>You create staff accounts and decide what each person can do.</p></div>
            </div>
            <div className="startup-benefit">
              <span><Building2 size={20} /></span>
              <div><strong>Ready for every branch</strong><p>Keep daily work separate while management sees the whole business.</p></div>
            </div>
            <div className="startup-benefit">
              <span><UsersRound size={20} /></span>
              <div><strong>Security that fits your team</strong><p>Add staff credentials now and optional authenticator 2FA later.</p></div>
            </div>
          </div>

          <div className="startup-credit">Developed by Scopule</div>
        </aside>

        <main className="startup-main">
          <div className="startup-form-wrap">
            <div className="eyebrow">ONE-TIME OWNER SETUP</div>
            <h2>Create your admin account</h2>
            <p className="startup-form-intro">This first administrator can manage every branch, staff account and setting. Add the shop name, address and phone next in Shop setup.</p>

            {checkingSetup ? (
              <div className="startup-loading" role="status">
                <span className="startup-spinner" />
                <strong>Preparing your workspace</strong>
                <p>Checking that this installation is ready…</p>
              </div>
            ) : statusError ? (
              <div className="startup-loading startup-status-error" role="alert">
                <ShieldCheck size={28} />
                <strong>Setup check unavailable</strong>
                <p>{statusError}</p>
                <Button variant="outline" onClick={() => void checkInstallation()}>Try again</Button>
              </div>
            ) : (
              <form className="startup-form" onSubmit={submit}>
                <div className="startup-form-section">
                  <KeyRound size={17} />
                  <div><strong>Owner account</strong><span>Your private login credentials</span></div>
                </div>
                <Field label="Owner name">
                  <Input required maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" placeholder="Your full name" />
                </Field>
                <Field label="Super admin email">
                  <Input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@yourshop.com" />
                </Field>
                <p className="text-sm text-muted-foreground">Sign in with your username after setup. Verify this address from User management after configuring email delivery.</p>
                <Field label="Username">
                  <Input aria-label="Username" required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. owner" />
                  <small className="startup-field-hint">3–32 letters, numbers, dots, dashes or underscores.</small>
                </Field>
                <div className="startup-password-grid">
                  <Field label="Password">
                    <div className="relative"><Input type={showPassword ? 'text' : 'password'} className="pr-10" minLength={10} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Create a password" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                  </Field>
                  <Field label="Confirm password">
                    <div className="relative"><Input type={showPassword ? 'text' : 'password'} className="pr-10" aria-invalid={!!confirmation && confirmation !== password} minLength={10} maxLength={72} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="Repeat password" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                    {confirmation && confirmation !== password && <p className="mt-1 text-xs text-destructive">Passwords do not match</p>}
                    {confirmation && confirmation === password && <p className="mt-1 text-xs text-primary">Passwords match</p>}
                  </Field>
                </div>
                <p className="startup-password-hint">Use 10–72 characters with at least one letter and one number.</p>

                <Button type="submit" size="lg" disabled={busy} className="w-full startup-submit">
                  {busy ? 'Creating your workspace…' : 'Create admin & start'}
                  {!busy && <ArrowRight />}
                </Button>
                <div className="startup-security-note"><LockKeyhole size={15} />Setup closes permanently after the first admin is created.</div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
