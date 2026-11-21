import { PasswordInput } from './password-input';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Gem, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from './shared';
import { usePos } from './data';
import { supabase } from '@/integrations/supabase/client';
import { getInstallationStatus } from '@/lib/security.functions';
import { loginWithPassword } from '@/lib/accounts.functions';
import { validatePassword } from '@/lib/security-rules';
import { LAST_ACTIVITY_KEY } from './session-security';

export function Auth() {
  const { refresh } = usePos();
  const navigate = useNavigate();
  const installationStatus = useServerFn(getInstallationStatus);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const login = useServerFn(loginWithPassword);

  useEffect(() => {
    let active = true;
    void installationStatus()
      .then(async (status) => {
        if (status.needsSetup) {
          await navigate({ to: '/startup', replace: true });
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Could not check installation'))
      .finally(() => { if (active) setCheckingSetup(false); });
    return () => { active = false; };
  }, [installationStatus, navigate]);

  useEffect(() => {
    if (checkingSetup) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void finishSignIn().catch((error) => toast.error(error instanceof Error ? error.message : 'Could not continue login'));
    });
  }, [checkingSetup]);

  async function finishSignIn() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Login failed');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mfa_enabled,two_factor_required')
      .eq('id', user.id)
      .single();
    if (profileError) throw new Error('Your staff profile is unavailable');

    if (profile.mfa_enabled) {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw new Error('Could not check two-factor authentication');
      if (aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw new Error('Could not load your authenticator');
        const factor = factors.totp.find((item) => item.status === 'verified');
        if (!factor) throw new Error('Your authenticator needs to be set up again from Profile settings');
        setFactorId(factor.id);
        setCode('');
        return;
      }
    }

    const { data: allowed, error: accessError } = await supabase.rpc('login_access');
    if (accessError || !allowed) {
      await supabase.auth.signOut();
      throw new Error('This account is not active. Contact your shop administrator.');
    }
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    void refresh();
    if (profile.two_factor_required && !profile.mfa_enabled) {
      await navigate({ to: '/profile', search: { setup2fa: '1' } });
    } else {
      await navigate({ to: '/dashboard' });
    }
    toast.success('Logged in successfully');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const identifier = username.trim();
      validatePassword(password);
      const result = await login({ data: { identity: identifier, password } });
      const { error } = await supabase.auth.setSession(result.session);
      if (error) throw new Error('Invalid email/username or password');
      await finishSignIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const challenged = await supabase.auth.mfa.challenge({ factorId });
      if (challenged.error) throw challenged.error;
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (verified.error) throw new Error('That code is not valid. Check your authenticator and try again.');
      await finishSignIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not verify the code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-stack">
        <Link to="/auth" className="auth-brand-mark"><Gem size={30} />KaratDesk</Link>
        <div className="auth-brand-tagline">Jewellery POS &amp; Inventory</div>
      </div>
      <div className="auth-card">
        <div className="eyebrow">SECURE LOGIN</div>
        <h1>{factorId ? 'Enter your security code' : 'Welcome back'}</h1>
        <p>{factorId ? 'Open your authenticator app and enter its current six-digit code.' : 'Sign in with your username or verified email address.'}</p>
        {checkingSetup ? <p className="auth-loading">Checking installation…</p> : factorId ? (
          <form onSubmit={verify}>
            <Field label="Six-digit code"><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" autoFocus placeholder="123456" /></Field>
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">{busy ? 'Verifying…' : 'Verify and login'}<Smartphone /></Button>
            <Button type="button" variant="link" onClick={() => { void supabase.auth.signOut(); setFactorId(''); }}>Back to login</Button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <Field label="Username or email"><Input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" placeholder="Your username or email" /></Field>
            <Field label="Password"><PasswordInput minLength={10} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your password" /></Field>
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait…' : 'Login'}<ArrowRight /></Button>
          </form>
        )}
        {!factorId && <div className="auth-help"><Button asChild variant="link"><Link to="/reset-password">Forgot password?</Link></Button></div>}
        <div className="auth-secure"><ShieldCheck size={15} />Optional authenticator 2FA</div>
      </div>
      <div className="auth-brand-credit">Developed by Scopule</div>
    </div>
  );
}

export function ResetPassword() {
  return <div className="auth-page"><div className="auth-brand-stack"><div className="auth-brand-mark"><Gem size={30} />KaratDesk</div><div className="auth-brand-tagline">Jewellery POS &amp; Inventory</div></div><div className="auth-card"><h1>Password help</h1><p>Username accounts do not use email recovery. Ask your shop administrator to reset your password from User management.</p><Button asChild className="w-full mt-6"><Link to="/auth">Back to login</Link></Button></div><div className="auth-brand-credit">Developed by Scopule</div></div>;
}
