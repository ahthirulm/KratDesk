import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {inviteAccount,accountDirectory,sendExistingInvitation} from '@/lib/accounts.functions';
import { PasswordInput } from './password-input';
import { useState } from 'react';
import { UserPlus, Pencil, UsersRound, ShieldCheck, Power, KeyRound, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { usePos } from './data';
import { PageTitle, Stat, SearchBox, Select, Field, Empty } from './shared';
import { type DemoUser } from '@/lib/demo-users';
import { Checkbox } from '@/components/ui/checkbox';
import { PERMISSIONS, assignedBranchesForRole, type DemoRole } from '@/lib/demo-roles';

export function UserManagement() {
  const {
    data, refresh, staffRoles: roles, staffUsers: users, saveRole, saveStaff, createStaff,
    resetStaffPassword, setStaffTwoFactor, setStaffAdministrator, branches, expenseStaff: payees,
  } = usePos();
  const [roleEdit, setRoleEdit] = useState<{ old: string | null; role: DemoRole } | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All roles');
  const [editing, setEditing] = useState<DemoUser | null>(null);
  const [password, setPassword] = useState('');
  const [email,setEmail]=useState('');
  const invite=useServerFn(inviteAccount);
  const directory=useServerFn(accountDirectory);
  const resend=useServerFn(sendExistingInvitation);
  const contacts=useQuery({queryKey:['account-emails'],enabled:data.admin&&!data.demo,queryFn:()=>directory()});
  const [resetting, setResetting] = useState<DemoUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const filtered = users.filter((user) =>
    `${user.name} ${user.username}`.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'All roles' || user.role === filter),
  );
  const isNew = !!editing && !users.some((user) => user.id === editing.id);
  const ADMIN_ROLE = 'Administrator';
  // Only the owner may touch an administrator's login; the owner login is untouchable here.
  const locked = (user: DemoUser) => user.role === 'Super Admin' || (user.role === ADMIN_ROLE && !data.owner);
  const accessRoleName = (role: string) => role === ADMIN_ROLE
    ? (roles.find((item) => item.name === 'Cashier')?.name || roles.find((item) => item.name !== 'Super Admin')?.name || '')
    : role;

  function addStaff() {
    const role = roles.find((item) => item.name === 'Cashier') || roles.find((item) => item.name !== 'Super Admin');
    setEditing({
      id: crypto.randomUUID(), name: '', username: '', role: role?.name || '',
      branch: branches.find((branch) => branch.active)?.id || 'B1', active: true,
      twoFactorRequired: false, mfaEnabled: false,
    });
    setPassword('');setEmail('');
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const original = users.find((user) => user.id === editing.id);
      const wantsAdmin = editing.role === ADMIN_ROLE;
      const staff = { ...editing, branch: assignedBranchesForRole(editing.role, editing.branch, branches.filter(branch => branch.active).map(branch => branch.id)) };
      const access = { ...staff, role: accessRoleName(staff.role) };
      if(isNew&&!data.demo&&email.trim()){
        const role=roles.find(r=>r.name===access.role);
        if(!role)throw new Error('Select a role');
        const invitation=await invite({data:{name:editing.name,username:editing.username,email,roleName:role.name,branchIds:staff.branch.split(',').map(b=>b.trim()),active:editing.active,administrator:wantsAdmin}});
        setEditing(null);await contacts.refetch();await refresh();if(invitation.sent)toast.success('Invitation sent');else toast.error('User saved, but email delivery failed. Use Send invitation again.');return;
      }
      if (wantsAdmin) {
        if (isNew && !data.demo) await createStaff(access, password);
        else if (isNew) await saveStaff(access);
        await setStaffAdministrator(staff, true);
      } else {
        if (original?.role === ADMIN_ROLE) await setStaffAdministrator(staff, false);
        if (isNew && !data.demo) await createStaff(access, password);
        else await saveStaff(access);
      }
      setEditing(null);
      setPassword('');
      toast.success(data.demo ? 'Sample user saved · no live account created' : isNew ? 'User login created' : 'User access saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save user');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTwoFactor(user: DemoUser, required: boolean) {
    setBusy(true);
    try {
      await setStaffTwoFactor(user, required);
      toast.success(required ? `2FA requested for ${user.name}` : `2FA is now optional for ${user.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update 2FA');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageTitle
      title="User management"
      subtitle="User credentials, branch access and optional authenticator verification"
      actions={<Button onClick={addStaff}><UserPlus />Add user</Button>}
    />
    <div className="stats-grid">
      <Stat label="Total users" value={users.length} icon={<UsersRound />} />
      <Stat label="Active users" value={users.filter((user) => user.active).length} />
      <Stat label="2FA enabled" value={users.filter((user) => user.mfaEnabled).length} icon={<Smartphone />} />
      <Stat label="Super admins" value={users.filter((user) => user.role === 'Super Admin').length} icon={<ShieldCheck />} />
      <Stat label="Administrators" value={users.filter((user) => user.role === ADMIN_ROLE).length} icon={<ShieldCheck />} />
    </div>
    <details className="dashboard-section"><summary>Account invitations and recovery emails</summary>{users.map(user=>{const contact=contacts.data?.find(c=>c.user_id===user.id);return <div className="flex flex-wrap items-center gap-2 py-2" key={user.id}><span>{user.name} · {contact?.email||'Email not registered'} · {contact?.verified_at?'Verified':contact?'Invitation pending':'Needs email'}</span><Button variant="outline" disabled={busy||(!data.owner&&locked(user))} onClick={async()=>{const address=window.prompt('Email address for invitation',contact?.email||'');if(!address)return;setBusy(true);try{await resend({data:{userId:user.id,email:address}});await contacts.refetch();toast.success('Invitation sent');}catch(error){toast.error(error instanceof Error?error.message:'Could not send invitation');}finally{setBusy(false);}}}>Send invitation</Button></div>})}</details>
    <section className="dashboard-section">
      <div className="dashboard-heading"><h2>User directory</h2></div>
      <div className="filter-row">
        <SearchBox value={search} set={setSearch} placeholder="Search user name or username" />
        <Select value={filter} onChange={setFilter} options={['All roles', ...roles.map((role) => role.name), ...(data.owner ? [ADMIN_ROLE] : [])]} label="Filter role" />
      </div>
      <div className="table-scroll"><table><thead><tr><th>STAFF NAME / USERNAME</th><th>ROLE</th><th>BRANCH</th><th>STATUS</th><th>2FA</th><th>ACTIONS</th></tr></thead><tbody>
        {filtered.map((user) => {
          const branchNames = user.branch === 'All branches' ? 'All branches' : user.branch.split(',').map((id) => branches.find((branch) => branch.id === id.trim())?.name || id.trim()).join(', ');
          return <tr key={user.id}>
            <td><b>{user.name}</b><small>{user.username}</small></td>
            <td>{user.role}</td><td>{branchNames}</td>
            <td><span className={`badge ${user.active ? 'success' : 'neutral'}`}>{user.active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <div className="two-factor-cell">
                <Switch
                  aria-label={`Require 2FA for ${user.name}`}
                  checked={!!user.twoFactorRequired || !!user.mfaEnabled}
                  disabled={busy || locked(user)}
                  onCheckedChange={(checked) => void toggleTwoFactor(user, checked)}
                />
                <small>{user.mfaEnabled ? 'Enabled' : user.twoFactorRequired ? 'Setup required' : 'Optional'}</small>
              </div>
            </td>
            <td><div className="flex gap-1">
              <Button size="icon" variant="ghost" title={`Edit ${user.name}`} disabled={!data.demo && locked(user)} onClick={() => setEditing({ ...user })}><Pencil /></Button>
              <Button size="icon" variant="ghost" title={`Reset password for ${user.name}`} disabled={locked(user)} onClick={() => { setResetting(user); setResetPassword(''); }}><KeyRound /></Button>
              <Button size="icon" variant="ghost" title={`${user.active ? 'Deactivate' : 'Activate'} ${user.name}`} disabled={locked(user)} onClick={async () => {
                try { await saveStaff({ ...user, active: !user.active }); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update user'); }
              }}><Power /></Button>
            </div></td>
          </tr>;
        })}
      </tbody></table></div>
      {!filtered.length && <Empty title="No matching users" description="" />}
      <section className="dashboard-section"><div className="dashboard-heading"><h2>Expense payees</h2><span>No login access</span></div>{payees.length?<div className="table-scroll"><table><thead><tr><th>NAME</th><th>TYPE</th><th>BRANCH</th><th>PHONE</th><th>NOTE</th></tr></thead><tbody>{payees.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.payee_type}</td><td>{branches.find(b=>b.id===p.branch_id)?.name||p.branch_id}</td><td>{p.phone||'—'}</td><td>{p.note||'—'}</td></tr>)}</tbody></table></div>:<Empty title="No expense payees" description="Add them from Expenses with the + button."/>}</section>
      <p className="security-note">2FA is never forced shop-wide. When requested, the user scans an authenticator QR code in their own Profile settings.</p>
    </section>

    <section className="dashboard-section">
      <div className="dashboard-heading"><h2>Roles & permissions</h2><Button onClick={() => setRoleEdit({ old: null, role: { name: '', permissions: [] } })}><ShieldCheck />Create role</Button></div>
      <div className="table-scroll"><table><thead><tr><th>ROLE</th><th>PERMISSIONS</th><th /></tr></thead><tbody>
        {roles.map((role) => <tr key={role.name}><td><b>{role.name}</b></td><td className="permission-cell">{role.permissions.join(', ') || 'No permissions'}</td><td><Button size="icon" variant="ghost" disabled={role.locked} title={`Edit permissions ${role.name}`} onClick={() => setRoleEdit({ old: role.name, role: { ...role, permissions: [...role.permissions] } })}><Pencil /></Button></td></tr>)}
      </tbody></table></div>
    </section>

    {roleEdit && <Dialog open onOpenChange={() => setRoleEdit(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{roleEdit.old ? 'Edit role' : 'Create role'}</DialogTitle></DialogHeader>
      <Field label="Role name"><Input value={roleEdit.role.name} onChange={(event) => setRoleEdit({ ...roleEdit, role: { ...roleEdit.role, name: event.target.value } })} /></Field>
      <div className="grid gap-3">{PERMISSIONS.map((permission) => <label key={permission} className="flex items-center gap-3"><Checkbox checked={roleEdit.role.permissions.includes(permission)} onCheckedChange={(checked) => setRoleEdit({ ...roleEdit, role: { ...roleEdit.role, permissions: checked ? [...roleEdit.role.permissions, permission] : roleEdit.role.permissions.filter((item) => item !== permission) } })} />{permission}</label>)}</div>
      <Button onClick={async () => { try { await saveRole(roleEdit.old, roleEdit.role); setRoleEdit(null); toast.success('Role permissions saved'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save role'); } }}>Save role</Button>
    </DialogContent></Dialog>}

    {editing && <Dialog open onOpenChange={() => setEditing(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{isNew ? 'Add user login' : 'Edit user access'}</DialogTitle></DialogHeader>
      <Field label="User name"><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoComplete="name" /></Field>
      <Field label="Username"><Input readOnly={!isNew && !data.demo} value={editing.username} onChange={(event) => setEditing({ ...editing, username: event.target.value })} autoComplete="off" autoCapitalize="none" placeholder="e.g. city.cashier" /></Field>
      {isNew && <Field label="Email address (optional)"><Input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" placeholder="Leave empty to create a local login"/></Field>}
      {isNew && !email.trim() && !data.demo && <Field label="Password"><PasswordInput minLength={10} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>}
      <Field label="Role"><Select value={editing.role} onChange={(role) => setEditing({ ...editing, role })} options={[...roles.filter((role) => !isNew || role.name !== 'Super Admin').map((role) => role.name), ...(data.owner ? [ADMIN_ROLE] : [])]} /></Field>
      {editing.role === ADMIN_ROLE && <p className="security-note">Administrators reach every screen and branch, but cannot run the shop reset. Only the owner can grant or remove this role.</p>}
      {editing.role === 'Managing Director' && <p className="security-note">All active branches are assigned automatically. Daily operations and reports are allowed; deep settings, user administration, voids and deletes stay owner-only.</p>}
      {editing.role !== 'Super Admin' && editing.role !== ADMIN_ROLE && <div className="grid gap-3"><span className="text-sm font-medium">Assigned branches</span>{branches.filter((branch) => branch.active).map((branch) => <label key={branch.id} className="flex items-center gap-3"><Checkbox disabled={editing.role === 'Managing Director'} checked={editing.role === 'Managing Director' || editing.branch.split(',').map((id) => id.trim()).includes(branch.id)} onCheckedChange={(checked) => { const ids = editing.branch.split(',').map((id) => id.trim()).filter(Boolean); setEditing({ ...editing, branch: (checked ? [...ids, branch.id] : ids.filter((id) => id !== branch.id)).join(', ') }); }} />{branch.name}</label>)}</div>}
      <Field label="Account status"><Select value={editing.active ? 'Active' : 'Inactive'} onChange={(active) => setEditing({ ...editing, active: active === 'Active' })} options={['Active', 'Inactive']} /></Field>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? 'Saving…' : isNew ? (email.trim() ? 'Send invitation' : 'Create user') : 'Save user'}</Button></div>
    </DialogContent></Dialog>}

    {resetting && <Dialog open onOpenChange={() => setResetting(null)}><DialogContent><DialogHeader><DialogTitle>Reset password for {resetting.name}</DialogTitle></DialogHeader>
      <p className="dialog-description">Give the user a new temporary password. Their username stays the same.</p>
      <Field label="New temporary password"><PasswordInput minLength={10} maxLength={72} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} autoComplete="new-password" /></Field>
      <Button disabled={busy} onClick={async () => {
        setBusy(true);
        try { await resetStaffPassword(resetting.id, resetPassword); setResetting(null); toast.success('User password reset'); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Could not reset password'); }
        finally { setBusy(false); }
      }}><KeyRound />Reset password</Button>
    </DialogContent></Dialog>}
  </>;
}
