import {useEffect,useState,type FormEvent} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {Link} from '@tanstack/react-router';
import {ArrowLeft,Gem,KeyRound,ShieldCheck} from 'lucide-react';
import {requestPasswordReset,finishAccountLink} from '@/lib/accounts.functions';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {PasswordInput} from './password-input';
import {Field} from './shared';

export function AccountRecovery(){
 const [code,setCode]=useState('');const [token,setToken]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [done,setDone]=useState(false);
 const request=useServerFn(requestPasswordReset);const finish=useServerFn(finishAccountLink);
 useEffect(()=>{setToken(new URLSearchParams(window.location.hash.slice(1)).get('token')||'');window.history.replaceState(null,'',window.location.pathname);},[]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setMessage('');try{if(token){if(password!==confirm)throw new Error('Passwords do not match');await finish({data:{token,password,code}});setMessage('Password saved. Sign in with your username or verified email and your new password.');setDone(true);}else{setMessage((await request({data:{email}})).message);}}catch(error){setMessage(error instanceof Error?error.message:'Please try again');}finally{setBusy(false);}}
 return <div className="auth-page">
  <div className="auth-brand-stack"><Link to="/auth" className="auth-brand-mark"><Gem size={30}/>KaratDesk</Link><div className="auth-brand-tagline">Jewellery POS &amp; Inventory</div></div>
  <div className="auth-card recovery-card">
   <div className="recovery-icon"><KeyRound size={22}/></div><div className="eyebrow">ACCOUNT RECOVERY</div>
   <h1>{token?'Set your password':'Forgot password'}</h1>
   <p>{token?'Choose a new password for your staff account.':'Enter your verified registered email. If it matches an account, a single-use reset link will be sent.'}</p>
   <form onSubmit={submit}>
    {!done&&(token?<><Field label="New password"><PasswordInput value={password} minLength={10} maxLength={72} required autoComplete="new-password" onChange={e=>setPassword(e.target.value)}/></Field><Field label="Confirm password"><PasswordInput value={confirm} minLength={10} maxLength={72} required autoComplete="new-password" aria-invalid={!!confirm&&confirm!==password} onChange={e=>setConfirm(e.target.value)}/></Field>{confirm&&confirm!==password&&<p className="form-message danger-text" role="alert">Passwords do not match</p>}<Field label="Authenticator code (if 2FA is enabled)"><Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} autoComplete="one-time-code" onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></Field></>:<Field label="Registered email"><Input type="email" required value={email} autoComplete="email" placeholder="you@yourshop.com" onChange={e=>setEmail(e.target.value)}/></Field>)}
    {message&&<p className="form-message" role="status">{message}</p>}
    {!done&&<Button disabled={busy||(!!token&&!!confirm&&confirm!==password)} type="submit" className="w-full">{busy?'Please wait…':token?'Save password':'Send reset link'}</Button>}
    <Button asChild variant="outline" className="w-full"><Link to="/auth"><ArrowLeft/>Back to login</Link></Button>
   </form>
   <div className="auth-secure"><ShieldCheck size={15}/>Single-use link · Secure account recovery</div>
  </div><div className="auth-brand-credit">Developed by Scopule</div>
 </div>;
}
