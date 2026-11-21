import { useState, type ReactNode } from 'react';
import {Link,useLocation} from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from './password-input';
import { verifyStaffPassword } from '@/lib/verify-credential';
import { Gem,Printer,Search,ArrowLeft } from 'lucide-react';
export function PageTitle({title,subtitle,actions,embedded=false}:{title:string,subtitle?:string,actions?:ReactNode,embedded?:boolean}) {
 const path=useLocation().pathname;
 if(embedded)return <div className="page-heading report-content-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div>;
 const directories=['/branches','/users','/suppliers','/categories','/settings','/audit','/import-export','/system-health'];
 if(path==='/old-gold-reports')return <><Button asChild variant="ghost" size="sm" className="page-back"><Link to="/old-gold"><ArrowLeft size={18}/>Back</Link></Button><div className="page-heading"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div></>;
 return <>{['/currencies','/currency-reports'].includes(path)&&<Button asChild variant="ghost" size="sm" className="page-back"><Link to="/currency-exchange"><ArrowLeft size={18}/>Back</Link></Button>}{directories.includes(path)&&<Button asChild variant="ghost" size="sm" className="page-back" title="Back to administration"><Link to="/management"><ArrowLeft size={18}/>Back to Administration</Link></Button>}<div className="page-heading"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div></>;
}
export function Panel({title,icon,children,extra}:{title:string,icon?:ReactNode,children:ReactNode,extra?:ReactNode}) {return <section className="panel"><div className="panel-heading"><h2>{icon}{title}</h2>{extra}</div>{children}</section>}
export function Field({label,children}:{label:string,children:ReactNode}) {return <label className="field"><span>{label}</span>{children}</label>}
export function Select({value,onChange,options,label}:{value:string,onChange:(v:string)=>void,options:(string|{value:string;label:string})[],label?:string}) {return <select className="select-control" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(option=>{const normalized=typeof option==='string'?{value:option,label:option}:option;return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>})}</select>}
export function Empty({title,description}:{title:string,description:string}) {return <div className="empty-state"><div className="empty-gem"><Gem size={32}/></div><h3>{title}</h3><p>{description}</p></div>}
export function Stat({label,value,icon}:{label:string,value:string|number,icon?:ReactNode}){return <div className="stat"><span>{label}{icon}</span><strong>{value}</strong></div>}
export function SearchBox({value,set,placeholder='Search…'}:{value:string,set:(s:string)=>void,placeholder?:string}) {return <div className="search-box"><Search size={17}/><Input aria-label={placeholder} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/></div>}
export function PrintPreview({title,children,onClose}:{title:string,children:ReactNode,onClose:()=>void}){return <Dialog open onOpenChange={onClose}><DialogContent className="receipt-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="print-receipt">{children}</div><Button onClick={()=>window.print()}><Printer/>Print</Button></DialogContent></Dialog>}
export function Confirm({title,children,onConfirm,onClose}:{title:string,children:ReactNode,onConfirm:()=>void|Promise<void>,onClose:()=>void}){const [busy,setBusy]=useState(false);return <Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={async()=>{setBusy(true);try{await onConfirm()}finally{setBusy(false)}}}>{busy?'Please wait…':'Confirm'}</Button></div></DialogContent></Dialog>}
// Destructive actions confirm twice: the wording, then the staff member's own
// password checked against the sign-in server before anything is removed.
export function CredentialConfirm({title,detail,email,onConfirm,onClose,skipCredential=false}:{title:string,detail?:ReactNode,email:string,onConfirm:()=>void|Promise<void>,onClose:()=>void,skipCredential?:boolean}){
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  return <Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{detail}
    {!skipCredential&&<><Field label="Your password"><PasswordInput value={password} onChange={(event)=>{setPassword(event.target.value);setError('')}} autoComplete="current-password" /></Field>{error&&<p className="mt-1 text-xs text-destructive">{error}</p>}</>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||(!skipCredential&&!password)} onClick={async()=>{setBusy(true);setError('');try{if(!skipCredential){const ok=await verifyStaffPassword(email,password);if(!ok){setError('That password is not correct. Try again.');return;}}await onConfirm();}catch(e){setError(e instanceof Error?e.message:'The action could not be completed.');}finally{setBusy(false);}}}>{busy?'Please wait…':'Confirm'}</Button></div>
  </DialogContent></Dialog>;
}
