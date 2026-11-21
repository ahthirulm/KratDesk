import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Building2,ArrowUpRight,Plus,Pencil,ArrowRightLeft,ShieldCheck,Truck,Tags,UsersRound,Settings,HandCoins,TriangleAlert} from 'lucide-react';
import {toast} from 'sonner';
import {useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {usePos,type Branch} from './data';
import {PageTitle,Field,Empty} from './shared';
import {PasswordInput} from './password-input';
import {ScheduledBackup} from './scheduled-backup';
import {Fold,FoldGroup} from './fold';
import {verifyStaffPassword} from '@/lib/verify-credential';
import {RESET_GROUPS,resetReady} from '@/lib/shop-scope';
import {BACKUP_TABLES,RESTORE_ORDER,backupRecordCount,backupRowsFor,isEncryptedBackup,type BackupFile} from '@/lib/backup';
import {restoreBackup} from '@/lib/restore.functions';
import {downloadBlob} from '@/lib/download';
import {today} from '@/lib/pos-rules';
import {Download,Upload,Lock} from 'lucide-react';
import {useRef} from 'react';
import {Checkbox} from '@/components/ui/checkbox';
import {supabase} from '@/integrations/supabase/client';
import {formatWeight} from '@/lib/pos-rules';
export function CentralManagement(){
 const {allData,branches,staffUsers,movements,can,data,isManagingDirector}=usePos();
 if(!['Manage settings','Manage users','Manage suppliers','Manage categories'].some(p=>can(p)))return <Empty title="Administration access required" description=""/>;
 return <><PageTitle title="Administration" subtitle="All authorised branches"/><FoldGroup title="Management"><Fold defaultOpen title="Shop administration"><div className="management-grid">{[{to:'/branches',name:'Branches',icon:Building2,permission:'Manage settings'},{to:'/users',name:'Users & permissions',icon:ShieldCheck,permission:'Manage users'},{to:'/settings',name:'Shop settings',icon:Settings,permission:'Manage settings'}].filter(l=>can(l.permission)).map(l=><Button asChild variant="outline" key={l.to}><Link to={l.to}><l.icon/><span>{l.name}</span><ArrowUpRight/></Link></Button>)}</div></Fold><Fold defaultOpen title="Stock directories"><div className="management-grid">{[{to:'/suppliers',name:'Suppliers',icon:Truck,permission:'Manage suppliers'},{to:'/categories',name:'Stock categories',icon:Tags,permission:'Manage categories'}].filter(l=>can(l.permission)).map(l=><Button asChild variant="outline" key={l.to}><Link to={l.to}><l.icon/><span>{l.name}</span><ArrowUpRight/></Link></Button>)}</div></Fold><Fold defaultOpen title="Records & tools"><div className="management-grid">{[{to:'/import-export',name:'Import / export',icon:ArrowRightLeft,permission:'Manage settings'},{to:'/audit',name:'Audit history',icon:ShieldCheck,permission:'Manage settings'},...(data.owner?[{to:'/system-health' as const,name:'System health',icon:ShieldCheck,permission:'Manage settings'}]:[])].filter(l=>can(l.permission)).map(l=><Button asChild variant="outline" key={l.to}><Link to={l.to}><l.icon/><span>{l.name}</span><ArrowUpRight/></Link></Button>)}</div></Fold></FoldGroup><FoldGroup title="Backup & recovery">{(data.admin||isManagingDirector)&&<BackupRestore/>}{data.owner&&!data.demo&&<ScheduledBackup/>}</FoldGroup>{data.owner&&<FoldGroup title="Danger zone"><FactoryReset/></FoldGroup>}</>;
}
// Owner-only wipe of every shop record. It asks for the typed wording and the
// owner's own password, then clears the database in one server-side transaction.
function FactoryReset(){
 const {data,branches}=usePos();
 const client=useQueryClient();
 const [open,setOpen]=useState(false);
 const [phrase,setPhrase]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [pickedBranches,setPickedBranches]=useState<string[]>([]);
 const [pickedGroups,setPickedGroups]=useState<string[]>([]);
 const active=branches.filter(b=>b.active);
 const everyBranch=active.length>0&&pickedBranches.length===active.length;
 const widePending=!everyBranch&&pickedGroups.some(id=>RESET_GROUPS.find(g=>g.id===id)?.wide);
 const ready=resetReady(phrase,password,pickedBranches,pickedGroups)&&!widePending;
 const toggle=(list:string[],id:string,set:(value:string[])=>void)=>set(list.includes(id)?list.filter(v=>v!==id):[...list,id]);
 const pickAll=()=>{setPickedBranches(active.map(b=>b.id));setPickedGroups(RESET_GROUPS.map(g=>g.id));};
 const openDialog=()=>{setPhrase('');setPassword('');setError('');setPickedBranches([]);setPickedGroups([]);setOpen(true);};
 const run=async()=>{
  setBusy(true);setError('');
  try{
   const ok=await verifyStaffPassword(data.user?.email||'',password);
   if(!ok){setError('That password is not correct. Try again.');return;}
   const {error:resetError}=await supabase.rpc('factory_reset',{p:{branches:pickedBranches,groups:pickedGroups}});
   if(resetError){setError(resetError.message);return;}
   client.clear();
   toast.success('Selected shop records cleared');
   window.location.assign('/dashboard');
  }catch(e){
   setError(e instanceof Error?e.message:'The reset could not be completed.');
  }finally{setBusy(false);}
 };
 return <><Fold tone="danger" title="Factory reset" icon={<TriangleAlert/>} note="Choose which branches and which records to clear. Your owner login, shop name and printing preferences always stay."><Button variant="outline" className="factory-reset-trigger" onClick={openDialog}><TriangleAlert/>Open factory reset</Button></Fold>
  {open&&<Dialog open onOpenChange={()=>{if(!busy)setOpen(false)}}><DialogContent className="max-h-[88dvh] overflow-y-auto"><DialogHeader><DialogTitle>Factory reset</DialogTitle></DialogHeader>
   <div className="factory-reset-summary"><p><b>This cannot be undone.</b> Tick only what you want cleared.</p></div>
   <div className="reset-block"><div className="reset-block-head"><b>Branches</b><Button size="sm" variant="ghost" onClick={()=>setPickedBranches(everyBranch?[]:active.map(b=>b.id))}>{everyBranch?'Clear all':'Select all'}</Button></div>
    <div className="reset-options">{active.map(b=><label key={b.id} className="reset-option"><Checkbox checked={pickedBranches.includes(b.id)} onCheckedChange={()=>toggle(pickedBranches,b.id,setPickedBranches)}/><span><b>{b.name}</b><small>{b.code}</small></span></label>)}</div>
   </div>
   <div className="reset-block"><div className="reset-block-head"><b>Records</b><Button size="sm" variant="ghost" onClick={()=>setPickedGroups(pickedGroups.length===RESET_GROUPS.length?[]:RESET_GROUPS.map(g=>g.id))}>{pickedGroups.length===RESET_GROUPS.length?'Clear all':'Select all'}</Button></div>
    <div className="reset-options">{RESET_GROUPS.map(g=><label key={g.id} className="reset-option"><Checkbox checked={pickedGroups.includes(g.id)} onCheckedChange={()=>toggle(pickedGroups,g.id,setPickedGroups)}/><span><b>{g.label}</b><small>{g.note}{g.wide?' · every branch':''}</small></span></label>)}</div>
   </div>
   <div className="flex flex-wrap gap-3 items-center"><Button size="sm" variant="outline" onClick={pickAll}><TriangleAlert/>Reset everything</Button><span className="text-xs">Selected: {pickedBranches.length} branch{pickedBranches.length===1?'':'es'} · {pickedGroups.length} record type{pickedGroups.length===1?'':'s'}</span></div>
   {widePending&&<p className="mt-1 text-xs text-destructive">Customers, suppliers and categories, rates and staff are shop-wide — select every branch to include them.</p>}
   <Field label="Type FACTORY RESET to confirm"><Input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="FACTORY RESET" autoComplete="off"/></Field>
   <Field label="Your password"><PasswordInput value={password} onChange={e=>{setPassword(e.target.value);setError('')}} autoComplete="current-password"/></Field>
   {error&&<p className="mt-1 text-xs text-destructive">{error}</p>}
   <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy||!ready} onClick={run}>{busy?'Clearing…':'Reset the shop'}</Button></div>
  </DialogContent></Dialog>}</>;
}
function BackupRestore(){
 const {data,branches}=usePos();
 const client=useQueryClient();
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [seal,setSeal]=useState(false);
 const [backupPicked,setBackupPicked]=useState<string[]>(()=>branches.filter(b=>b.active).map(b=>b.id));
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [file,setFile]=useState<BackupFile|null>(null);
 const [fileName,setFileName]=useState('');
 const [pending,setPending]=useState('');
 const [picked,setPicked]=useState<string[]>([]);
 const [restorePassword,setRestorePassword]=useState('');
 const [restoring,setRestoring]=useState(false);
 const [error,setError]=useState('');
 const active=branches.filter(b=>b.active);
 const everyBranch=active.length>0&&picked.length===active.length;
 const rows=file?backupRecordCount(file):0;

 const download=async()=>{
  setBusy(true);
  try{
   if(seal){
    if(password.length<10)throw new Error('Use a password of at least 10 characters');
    if(password!==confirm)throw new Error('The two passwords do not match');
   }
   const out:Record<string,unknown[]>={};
   const kept=new Map<string,Set<string>>();
   for(const t of BACKUP_TABLES){
    const list:unknown[]=[];
    for(let from=0;;from+=1000){
     const {data:page,error:readError}=await supabase.from(t).select('*').range(from,from+999);
     if(readError)throw new Error(`${t}: ${readError.message}`);
     list.push(...(page||[]));
     if(!page||page.length<1000)break;
    }
    out[t]=backupRowsFor(t,list as Record<string,unknown>[],backupPicked,kept);
   }
   let text=JSON.stringify({app:'KaratDesk',created_at:new Date().toISOString(),branches:backupPicked,tables:out});
   if(seal){
    const {encryptBackup}=await import('@/lib/backup-crypto');
    text=await encryptBackup(text,password);
   }
   const count=Object.values(out).reduce((a,r)=>a+r.length,0);
   downloadBlob(new Blob([text],{type:'application/json'}),`karatdesk-backup-${today()}.${seal?'enc':'json'}`);
   toast.success(`${count} records saved${seal?' · sealed with your password':''}`);
  }catch(e){
   toast.error(e instanceof Error?e.message:'The backup could not be prepared');
  }finally{setBusy(false);}
 };

 const open=async(text:string,name:string,pass:string)=>{
  let raw=text;
  if(isEncryptedBackup(text)){
   if(!pass)throw new Error('This backup is sealed — enter its password');
   const {decryptBackup}=await import('@/lib/backup-crypto');
   raw=await decryptBackup(text,pass);
  }
  const parsed=JSON.parse(raw) as BackupFile;
  if(parsed.app!=='KaratDesk'||!parsed.tables)throw new Error('This is not a KaratDesk backup file');
  setFile(parsed);setFileName(name);setPicked(active.map(b=>b.id));setError('');
 };

 const run=async()=>{
  if(!file)return;
  setRestoring(true);setError('');
  try{
   const ok=await verifyStaffPassword(data.user?.email||'',restorePassword);
   if(!ok){setError('That password is not correct. Try again.');return;}
   const coveredBranches=file.branches;
   if(coveredBranches&&picked.some(id=>!coveredBranches.includes(id)))throw new Error('That backup does not cover every branch you selected');
   const tables:Record<string,Record<string,unknown>[]>={};
   for(const spec of RESTORE_ORDER)tables[spec.table]=file.tables[spec.table]||[];
   tables['metal_types']=file.tables['metal_types']||[];
   const result=await restoreBackup({data:{created_at:file.created_at,branches:picked,tables}});
   const {error:seqError}=await supabase.rpc('sync_shop_sequences');
   if(seqError)throw new Error(seqError.message);
   client.clear();
   toast.success(`${result.restored} records restored`);
   window.location.assign('/dashboard');
  }catch(e){
   setError(e instanceof Error?e.message:'The restore could not be completed.');
  }finally{setRestoring(false);}
 };

 return <><Fold title="Backup" note="Save branch records in one file, optionally password-sealed.">
  <div className="backup-form">
   <div className="reset-block"><div className="reset-block-head"><b>Branches to back up</b><Button size="sm" variant="ghost" onClick={()=>setBackupPicked(backupPicked.length===active.length?[]:active.map(b=>b.id))}>{backupPicked.length===active.length?'Clear all':'Select all'}</Button></div>
    <div className="reset-options">{active.map(b=><label key={b.id} className="reset-option"><Checkbox checked={backupPicked.includes(b.id)} onCheckedChange={()=>setBackupPicked(backupPicked.includes(b.id)?backupPicked.filter(v=>v!==b.id):[...backupPicked,b.id])}/><span><b>{b.name}</b><small>{b.code}</small></span></label>)}</div>
   </div>
   <p className="text-xs">Shop-wide records (customers, suppliers, categories, rates, sign-in records) are always included so the file can be restored later.</p>
   <label className="flex items-center gap-3"><Checkbox checked={seal} onCheckedChange={(checked)=>setSeal(checked===true)}/><span><b className="text-sm">Seal with a password</b><small className="block text-xs">The file cannot be opened or restored without it.</small></span></label>
   {seal&&<div className="grid gap-3"><Field label="Backup password"><PasswordInput value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 10 characters"/></Field><Field label="Repeat password"><PasswordInput value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></Field></div>}
   <Button disabled={busy||data.demo===true||!backupPicked.length} onClick={download}><Download/>{busy?'Preparing backup…':seal?'Download sealed backup':'Download backup'}</Button>
  </div>
 </Fold>
 <Fold title="Restore" note="Replace chosen branches' records from a backup file. Logins and settings never change.">
  <input ref={input} type="file" accept=".json,.enc" className="hidden" onChange={async e=>{
   const f=e.target.files?.[0];
   if(!f)return;
   try{
    const text=await f.text();
    if(isEncryptedBackup(text)&&!pending){setFile(null);setFileName(f.name);setError('This backup is sealed — enter its password, then choose the file again.');}
    else await open(text,f.name,pending);
   }catch(err){setError(err instanceof Error?err.message:'The file could not be read');setFile(null);}
   e.target.value='';
  }}/>
  <div className="backup-form">
   <Field label="Sealed backup password"><PasswordInput value={pending} onChange={e=>{setPending(e.target.value);setError('')}} autoComplete="off" placeholder="Only needed for a sealed (.enc) file"/></Field>
   <Button variant="outline" onClick={()=>input.current?.click()}><Upload/>Choose backup file</Button>
   {file&&<div className="backup-preview">
    <p><b>{fileName}</b><small className="block text-xs">Saved {new Date(file.created_at).toLocaleString('en-GB',{timeZone:'Asia/Colombo'})} · {rows} records</small></p>
    {file.branches&&<p className="text-xs">Covers {file.branches.length} branch{file.branches.length===1?'':'es'}: {file.branches.map(id=>branches.find(b=>b.id===id)?.name||id).join(', ')}</p>}
    <div className="reset-block"><div className="reset-block-head"><b>Branches to restore</b><Button size="sm" variant="ghost" onClick={()=>setPicked(everyBranch?[]:active.map(b=>b.id))}>{everyBranch?'Clear all':'Select all'}</Button></div>
     <div className="reset-options">{active.map(b=><label key={b.id} className="reset-option"><Checkbox checked={picked.includes(b.id)} onCheckedChange={()=>setPicked(picked.includes(b.id)?picked.filter(v=>v!==b.id):[...picked,b.id])}/><span><b>{b.name}</b><small>{b.code}</small></span></label>)}</div>
    </div>
    {!everyBranch&&<p className="text-xs">Shop-wide records (customers, suppliers, categories, rates, job types) are only restored when every branch is selected.</p>}
    <Field label="Your password"><PasswordInput value={restorePassword} onChange={e=>{setRestorePassword(e.target.value);setError('')}} autoComplete="current-password"/></Field>
    {error&&<p className="text-xs text-destructive">{error}</p>}
    <Button variant="destructive" disabled={restoring||!picked.length||!restorePassword} onClick={run}>{restoring?'Restoring…':`Restore ${rows} records`}</Button>
   </div>}
   {!file&&error&&<p className="text-xs text-destructive">{error}</p>}
  </div>
 </Fold></>;
}

export function BranchManagement(){const {branches,saveBranch,can}=usePos();const [edit,setEdit]=useState<Branch|null>(null);const [busy,setBusy]=useState(false);if(!can('Manage settings'))return <Empty title="Owner access required" description=""/>;return <><PageTitle title="Branches" subtitle="Central branch directory" actions={<Button onClick={()=>setEdit({id:crypto.randomUUID(),code:'',name:'',address:'',phone:'',active:true})}><Plus/>Add branch</Button>}/><section className="dashboard-section"><div className="table-scroll"><table><thead><tr><th>BRANCH / CODE</th><th>ADDRESS</th><th>PHONE</th><th>STATUS</th><th/></tr></thead><tbody>{branches.map(b=><tr key={b.id}><td><b>{b.name}</b><small>{b.code}</small></td><td>{b.address||'—'}</td><td>{b.phone||'—'}</td><td><span className={`badge ${b.active?'success':'neutral'}`}>{b.active?'Active':'Inactive'}</span></td><td><Button size="icon" variant="ghost" title={`Edit ${b.name}`} onClick={()=>setEdit({...b})}><Pencil/></Button></td></tr>)}</tbody></table></div></section>{edit&&<Dialog open onOpenChange={()=>setEdit(null)}><DialogContent><DialogHeader><DialogTitle>{branches.some(b=>b.id===edit.id)?'Edit branch':'Add branch'}</DialogTitle></DialogHeader>{(['name','code','address','phone'] as const).map(key=><Field key={key} label={`Branch ${key}`}><Input value={edit[key]} onChange={e=>setEdit({...edit,[key]:e.target.value})}/></Field>)}<Field label="Status"><select className="select-control" value={edit.active?'Active':'Inactive'} onChange={e=>setEdit({...edit,active:e.target.value==='Active'})}><option>Active</option><option>Inactive</option></select></Field><Button disabled={busy} onClick={async()=>{setBusy(true);try{await saveBranch(edit);setEdit(null);toast.success('Branch saved')}catch(e){toast.error(e instanceof Error?e.message:'Could not save branch')}finally{setBusy(false)}}}>Save branch</Button></DialogContent></Dialog>}</>}
export function Transfers(){const {data,branches,branch,movements,transfer,can}=usePos();const [item,setItem]=useState('');const [to,setTo]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);if(!can('Transfer stock'))return <Empty title="Transfer permission required" description=""/>;const destinations=branches.filter(b=>b.active&&b.id!==branch);return <><PageTitle title="Stock transfers" subtitle={`${branches.find(b=>b.id===branch)?.name} · Movement history`}/><section className="dashboard-section"><h2 className="mb-5 font-semibold">Transfer a piece</h2><div className="form-grid"><Field label="In-stock piece"><select className="select-control" value={item} onChange={e=>setItem(e.target.value)}><option value="">Select jewellery</option>{data.items.filter(i=>i.status==='In Stock').map(i=><option key={i.id} value={i.id}>{i.tag_id} · {i.name} · {formatWeight(i.weight)}</option>)}</select></Field><Field label="Destination branch"><select className="select-control" value={to} onChange={e=>setTo(e.target.value)}><option value="">Select branch</option>{destinations.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Transfer note"><Input value={note} onChange={e=>setNote(e.target.value)}/></Field></div><Button className="mt-5" disabled={!item||!to||busy} onClick={async()=>{setBusy(true);try{await transfer(item,to,note);setItem('');setNote('');toast.success(data.demo?'Sample piece transferred · live records unchanged':'Piece transferred')}catch(e){toast.error(e instanceof Error?e.message:'Could not transfer')}finally{setBusy(false)}}}><ArrowRightLeft/>Transfer piece</Button></section><section className="dashboard-section"><div className="dashboard-heading"><h2>Movement history</h2></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>INTERNAL / SYSTEM TAG</th><th>FROM</th><th>TO</th><th>NOTE</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleDateString('en-GB',{timeZone:'Asia/Colombo'})}</td><td><b>{m.internal_tag}</b><small>{m.system_tag}</small></td><td>{branches.find(b=>b.id===m.from_branch)?.name}</td><td>{branches.find(b=>b.id===m.to_branch)?.name}</td><td>{m.note||'—'}</td></tr>)}</tbody></table></div>{!movements.length&&<Empty title="No stock movements yet" description=""/>}</section></>}
