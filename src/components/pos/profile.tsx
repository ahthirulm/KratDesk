import { PasswordInput } from './password-input';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Camera, Save, Trash2, ArrowLeft, LogOut, UserRound, ChevronDown, ShieldCheck, Smartphone, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProfile } from './profile-data';
import { usePos } from './data';
import { PageTitle, Field } from './shared';
import { validateAvatar } from '@/lib/profile-rules';
import { validatePassword } from '@/lib/security-rules';
import { supabase } from '@/integrations/supabase/client';

export function HeaderProfile({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { profile } = useProfile();
  const { data } = usePos();
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" className="header-profile" aria-label="Open profile settings" title={profile.display_name}>
      <span className="staff-avatar">{profile.photo ? <img src={profile.photo} alt="Profile" /> : profile.display_name.slice(0, 2).toUpperCase()}</span>
      <span className="header-profile-text"><b>{profile.display_name}</b><small>{data.demo ? 'Sample profile' : data.admin ? 'Administrator' : 'Staff'}</small></span><ChevronDown size={14} />
    </Button></PopoverTrigger>
    <PopoverContent align="end" className="profile-menu"><b>{profile.display_name}</b><small>{profile.username ? `@${profile.username}` : 'Staff profile'}</small>
      <Button asChild variant="ghost" onClick={() => setOpen(false)}><Link to="/profile"><UserRound />Profile & security</Link></Button>
      {data.user && <Button variant="ghost" onClick={onSignOut}><LogOut />Sign out</Button>}
    </PopoverContent>
  </Popover>;
}

export function ProfileSettings() {
  const { data, refresh } = usePos();
  const { profile, save, loading, error } = useProfile();
  const [name, setName] = useState(profile.display_name);
  const [phone, setPhone] = useState(profile.phone);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [factor, setFactor] = useState<{ id: string; status: string } | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => { setName(profile.display_name); setPhone(profile.phone); }, [profile.display_name, profile.phone]);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadFactors = useCallback(async () => {
    if (!data.user) { setFactor(null); return; }
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) { toast.error('Could not load authenticator settings'); return; }
    const verified = factors.totp.find((item) => item.status === 'verified');
    setFactor(verified ? { id: verified.id, status: verified.status } : null);
  }, [data.user]);
  useEffect(() => { void loadFactors(); }, [loadFactors]);

  const photo = preview || (remove ? '' : profile.photo);

  async function beginEnrollment() {
    setBusy(true);
    try {
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `KaratDesk (${profile.username || 'staff'})` });
      if (enrollError) throw enrollError;
      setEnrollment({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
      setCode('');
    } catch (enrollError) {
      toast.error(enrollError instanceof Error ? enrollError.message : 'Could not start authenticator setup');
    } finally { setBusy(false); }
  }

  async function verifyEnrollment() {
    if (!enrollment) return;
    setBusy(true);
    try {
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: code.trim() });
      if (verified.error) throw new Error('That code is not valid. Check your authenticator and try again.');
      const { error: saveError } = await supabase.rpc('set_profile_mfa', { enabled: true });
      if (saveError) throw saveError;
      setEnrollment(null);
      await Promise.all([loadFactors(), refresh()]);
      toast.success('Authenticator 2FA enabled');
    } catch (verifyError) {
      toast.error(verifyError instanceof Error ? verifyError.message : 'Could not verify authenticator');
    } finally { setBusy(false); }
  }

  async function disableTwoFactor() {
    setBusy(true);
    try {
      const { error: saveError } = await supabase.rpc('set_profile_mfa', { enabled: false });
      if (saveError) throw saveError;
      if (factor) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError) throw unenrollError;
      }
      setFactor(null);
      await refresh();
      toast.success('Authenticator 2FA disabled');
    } catch (disableError) {
      toast.error(disableError instanceof Error ? disableError.message : 'Could not disable 2FA');
    } finally { setBusy(false); }
  }

  return <>
    <Button asChild variant="ghost" className="page-back"><Link to="/dashboard"><ArrowLeft />Back to dashboard</Link></Button>
    <PageTitle title="Profile & security" subtitle={profile.username ? `@${profile.username}` : 'Personal account'} />
    {profile.two_factor_required && !profile.mfa_enabled && <div className="rate-warning"><Smartphone size={16} /><span>Your administrator requested 2FA. Complete authenticator setup below before using shop records.</span></div>}
    {error && <div className="error-banner">{error}</div>}

    <form className="personal-profile-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true);
      try { await save(name, phone, file, remove); setFile(null); setRemove(false); toast.success('Profile saved'); }
      catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : 'Could not save profile'); }
      finally { setBusy(false); }
    }}>
      <section className="dashboard-section"><div className="dashboard-heading"><h2>Profile photo</h2></div><div className="profile-photo-row">
        <div className="profile-photo">{photo ? <img src={photo} alt="Profile photo" /> : <UserRound />}</div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => document.getElementById('profile-photo-input')?.click()}><Camera />Change photo</Button>
          <Input id="profile-photo-input" aria-label="Profile photo" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
            const next = event.target.files?.[0]; if (!next) return;
            try { validateAvatar(next); setFile(next); setRemove(false); } catch (avatarError) { toast.error(avatarError instanceof Error ? avatarError.message : 'Invalid photo'); }
            event.target.value = '';
          }} />
          {photo && <Button type="button" variant="ghost" title="Remove photo" aria-label="Remove photo" onClick={() => { setFile(null); setRemove(true); }}><Trash2 /></Button>}
        </div>
      </div></section>
      <section className="dashboard-section"><div className="dashboard-heading"><h2>Personal details</h2></div><div className="form-grid">
        <Field label="Display name"><Input aria-label="Display name" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Contact phone"><Input aria-label="Contact phone" type="tel" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="Username"><Input value={profile.username || 'Not assigned'} readOnly /></Field>
        <Field label="Access"><Input value={data.admin ? 'Super administrator' : 'Assigned by shop administrator'} readOnly /></Field>
      </div></section>
      <Button disabled={busy || loading || !data.user}><Save />{busy ? 'Saving…' : 'Save profile'}</Button>
    </form>

    <section className="dashboard-section security-section"><div className="dashboard-heading"><div><h2>Change password</h2><span>Use your current password to choose a new one.</span></div><KeyRound /></div>
      <form className="entry-form security-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true);
        try {
          validatePassword(newPassword);
          if (newPassword !== confirmPassword) throw new Error('The password confirmation does not match');
          const { error: updateError } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
          if (updateError) throw updateError;
          setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
          toast.success('Password changed');
        } catch (passwordError) { toast.error(passwordError instanceof Error ? passwordError.message : 'Could not change password'); }
        finally { setBusy(false); }
      }}>
        <Field label="Current password"><PasswordInput required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></Field>
        <div className="form-grid"><Field label="New password"><PasswordInput required minLength={10} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><PasswordInput required minLength={10} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />{confirmPassword && confirmPassword !== newPassword && <p className="mt-1 text-xs text-destructive">Passwords do not match</p>}</Field></div>
        <Button disabled={busy || !data.user}><KeyRound />Change password</Button>
      </form>
    </section>

    <section className="dashboard-section security-section"><div className="dashboard-heading"><div><h2>Authenticator-app 2FA</h2><span>Optional unless your administrator requests it for this account.</span></div><ShieldCheck /></div>
      <div className="two-factor-profile">
        <div><b>{profile.mfa_enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}</b><p>{profile.mfa_enabled ? 'Your password and a current six-digit authenticator code are required at sign-in.' : 'Add a changing six-digit code from Google Authenticator, Microsoft Authenticator or a compatible app.'}</p></div>
        {profile.mfa_enabled ? <Button variant="outline" disabled={busy || profile.two_factor_required} title={profile.two_factor_required ? 'Your administrator requires 2FA' : 'Disable 2FA'} onClick={disableTwoFactor}>Disable 2FA</Button> : !enrollment && <Button disabled={busy || !data.user} onClick={()=>{if(factor){setEnrollment({id:factor.id,qr:'',secret:''});setCode('');}else void beginEnrollment();}}><Smartphone />{factor ? 'Verify existing authenticator' : 'Set up authenticator'}</Button>}
      </div>
      {enrollment && <div className="authenticator-setup">
        {enrollment.qr&&<div className="qr-frame"><img src={enrollment.qr.startsWith("data:image/svg+xml") || enrollment.qr.startsWith("data:image/png;") ? enrollment.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`} alt="Authenticator QR code" /></div>}
        <div>{enrollment.qr?<><h3>1. Scan this QR code</h3><p>Or enter this setup key manually:</p><code>{enrollment.secret}</code><h3>2. Enter the six-digit code</h3></>:<h3>Verify your existing authenticator</h3>}
          <Field label="Authenticator code"><Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" placeholder="123456" /></Field>
          <div className="flex flex-wrap gap-2 mt-4"><Button disabled={busy || code.length !== 6} onClick={verifyEnrollment}>Verify & enable 2FA</Button><Button variant="ghost" onClick={() => setEnrollment(null)}>Cancel</Button></div>
        </div>
      </div>}
    </section>
  </>;
}
