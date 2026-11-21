import {displayReference} from '@/lib/display-reference';
import {Fragment,useState} from 'react';
import {Download,History,ArrowUpRight,Tags,Pencil,Trash2,UserPlus} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {usePos,type PettyEntry,type AuditEvent} from './data';
import {PageTitle,SearchBox,Select,Stat,Field,Empty,CredentialConfirm} from './shared';
import {downloadBlob} from '@/lib/download';
import {PettyCategories} from './petty-categories';
import {useCurrency} from './currency-data';
import {money,today} from '@/lib/pos-rules';
import {toSafeCsv} from '@/lib/spreadsheet';
import {EXPENSE_PAYEE_TYPES,type ExpensePayeeType} from '@/lib/expense-payees';
export function AuditHistory(){
 const {data,auditEvents,branches}=usePos();
 const [search,setSearch]=useState('');const [category,setCategory]=useState('All actions');const [action,setAction]=useState('All types');const [staff,setStaff]=useState('All staff');const [branch,setBranch]=useState('All branches');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [open,setOpen]=useState<AuditEvent|null>(null);
 if(!data.demo&&!data.admin)return <Empty title="Owner access required" description=""/>;
 const refLabel=(id:string|null)=>{if(!id)return '';const sale=data.sales.find(x=>x.id===id);if(sale)return `Bill ${displayReference(sale.invoice_no)}`;const loan=data.loans.find(x=>x.id===id);if(loan)return `Loan ${displayReference(loan.loan_no)}`;const pay=data.payments.find(x=>x.id===id);if(pay)return `Receipt ${displayReference(pay.receipt_no)}`.trim();const item=data.items.find(x=>x.id===id);if(item)return `${item.tag_id} · ${item.name}`;const c=data.customers.find(x=>x.id===id);if(c)return `Customer ${c.name}`;const st=data.staff.find(x=>x.id===id);if(st)return `Staff ${st.display_name}`;const b=branches.find(x=>x.id===id);if(b)return `Branch ${b.name}`;return /^[0-9a-f-]{36}$/i.test(id)?'':id};
 const branchName=(id:string|null)=>branches.find(b=>b.id===id)?.name||'Administration';
 const day=(iso:string)=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'Asia/Colombo'});
 const time=(iso:string,full=false)=>new Date(iso).toLocaleString('en-GB',{timeZone:'Asia/Colombo',...(full?{dateStyle:'full',timeStyle:'medium'}:{timeStyle:'short'})} as Intl.DateTimeFormatOptions);
 const filtered=auditEvents.filter(e=>{const d=day(e.created_at);return [e.description,e.actor_name,e.action,e.category,e.record_id||'',refLabel(e.record_id)].join(' ').toLowerCase().includes(search.toLowerCase())&&(category==='All actions'||category===e.category)&&(action==='All types'||action===e.action)&&(staff==='All staff'||staff===e.actor_name)&&(branch==='All branches'||branch===(e.branch_id||''))&&(!from||d>=from)&&(!to||d<=to)});
 const groups=filtered.reduce<Record<string,AuditEvent[]>>((g,e)=>{(g[day(e.created_at)]??=[]).push(e);return g},{});
 const todayCount=auditEvents.filter(e=>day(e.created_at)===today()).length;
 const deletes=filtered.filter(e=>/delete|remove|reset|void|restore/i.test(e.action+' '+e.description)).length;
 const tone=(e:AuditEvent)=>/delete|remove|reset|void|restore/i.test(e.action+' '+e.description)?'danger':/update|edit|change|adjust/i.test(e.action)?'success':'neutral';
 const clear=()=>{setSearch('');setCategory('All actions');setAction('All types');setStaff('All staff');setBranch('All branches');setFrom('');setTo('')};
 const exportCsv=()=>{const csv=toSafeCsv([['Date','Time (Colombo)','Staff','Branch','Category','Action','Description','Related record','Record ID','Event ID'],...filtered.map(e=>[day(e.created_at),time(e.created_at),e.actor_name,branchName(e.branch_id),e.category,e.action,e.description,refLabel(e.record_id),e.record_id||'',e.id])]);downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`audit-${today()}.csv`)};
 return <><PageTitle title="Audit history" subtitle={data.demo?'Sample activity · All branches':'Who did what, when and where · Latest 500 events'} actions={<Button variant="outline" onClick={exportCsv}><Download/>Export {filtered.length}</Button>}/>
 <div className="stats-grid"><Stat label="Showing" value={String(filtered.length)}/><Stat label="Today" value={String(todayCount)}/><Stat label="Staff involved" value={String(new Set(filtered.map(e=>e.actor_name)).size)}/><Stat label="Deletes & reversals" value={String(deletes)}/></div>
 <div className="filter-row flex-wrap"><SearchBox value={search} set={setSearch} placeholder="Search activity, staff or reference"/><Select label="Category" value={category} onChange={setCategory} options={['All actions',...new Set(auditEvents.map(e=>e.category))]}/><Select label="Action type" value={action} onChange={setAction} options={['All types',...new Set(auditEvents.map(e=>e.action))]}/><Select label="Staff" value={staff} onChange={setStaff} options={['All staff',...new Set(auditEvents.map(e=>e.actor_name))]}/><select aria-label="Audit branch" className="select-control" value={branch} onChange={e=>setBranch(e.target.value)}><option>All branches</option>{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}<option value="">Administration</option></select></div>
 <div className="flex flex-wrap items-end gap-3 mb-6"><Field label="From"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="To"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field><Button variant="ghost" onClick={clear}>Clear filters</Button></div>
 {Object.entries(groups).map(([d,list])=><section key={d} className="dashboard-section audit-list"><div className="dashboard-heading"><h2>{d===today()?'Today':new Date(d+'T00:00:00').toLocaleDateString('en-GB',{dateStyle:'full'})}</h2><span>{list.length} events</span></div>{list.map(e=><article key={e.id} role="button" tabIndex={0} className="cursor-pointer" onClick={()=>setOpen(e)} onKeyDown={k=>k.key==='Enter'&&setOpen(e)}><span className="audit-icon"><History size={18}/></span><div><b>{e.description}</b><p>{e.actor_name} · {branchName(e.branch_id)} · {e.action}</p><time>{time(e.created_at)} · Colombo</time>{refLabel(e.record_id)&&<span className="audit-ref">{refLabel(e.record_id)}</span>}</div><span className={`badge ${tone(e)}`}>{e.category}</span></article>)}</section>)}
 {!filtered.length&&<Empty title="No matching activity" description=""/>}
 {open&&<Dialog open onOpenChange={()=>setOpen(null)}><DialogContent><DialogHeader><DialogTitle>Activity details</DialogTitle></DialogHeader><p className="font-semibold">{open.description}</p><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">{([['When',time(open.created_at,true)+' (Colombo)'],['Staff',open.actor_name],['Branch',branchName(open.branch_id)],['Category',open.category],['Action',open.action],['Related record',refLabel(open.record_id)||'Not linked to a single record']] as const).map(([k,v])=><Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></Fragment>)}</dl><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Technical IDs</summary><p className="break-all mt-1">Record: {open.record_id||'—'}<br/>Event: {open.id}</p></details><p className="text-xs text-muted-foreground">Audit records are permanent and cannot be edited or deleted.</p><div className="flex gap-2"><Button variant="outline" onClick={()=>{setStaff(open.actor_name);setOpen(null)}}>All by this staff</Button>{open.record_id&&<Button variant="outline" onClick={()=>{setSearch(open.record_id!);setOpen(null)}}>History of this record</Button>}</div></DialogContent></Dialog>}
 </>}
export function PettyCash(){
 const {data,branch,branches,pettyEntries,pettyCategories,expenseStaff,addExpenseStaff,recordCash,changeExpense,can,staffUsers}=usePos();
 const {accounts,loading:currencyLoading}=useCurrency();
 const [manage,setManage]=useState(false);
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<PettyEntry|null>(null);
 const [deleting,setDeleting]=useState<PettyEntry|null>(null);
 const categoryOptions=pettyCategories.filter(c=>c.branch_id===branch).map(c=>c.name);
 const [amount,setAmount]=useState('');
 const [category,setCategory]=useState('Refreshments');
 const [description,setDescription]=useState('');
 const [reference,setReference]=useState('');
 const [expenseDate,setExpenseDate]=useState(today());
 const [selectedStaff,setSelectedStaff]=useState('');
 const [expenseMonth,setExpenseMonth]=useState(today().slice(0,7));
 const [addStaffOpen,setAddStaffOpen]=useState(false);
 const [newStaffName,setNewStaffName]=useState('');
 const [newStaffType,setNewStaffType]=useState<ExpensePayeeType>('Shop staff');
 const [newStaffPhone,setNewStaffPhone]=useState('');
 const [newStaffNote,setNewStaffNote]=useState('');
 const [staffBusy,setStaffBusy]=useState(false);
 const [busy,setBusy]=useState(false);
 if(!can('Manage expenses'))return <Empty title="Expense management permission required" description=""/>;
 const entries=pettyEntries.filter(e=>e.branch_id===branch&&e.kind==='Expense');
 const mainCash=accounts.find(a=>a.branch_id===branch&&a.currency==='LKR')?.balance||0;
 const total=entries.reduce((sum,e)=>sum+e.amount,0);
 const spentToday=entries.filter(e=>e.date===today()).reduce((sum,e)=>sum+e.amount,0);
 const selectedCategory=pettyCategories.find(c=>c.branch_id===branch&&c.name===category);
 const requiresStaff=selectedCategory?.requires_staff===true,requiresMonth=selectedCategory?.requires_month===true;
 const branchStaff=expenseStaff.filter(s=>s.branch_id===branch&&s.active);
 const loginStaff=staffUsers.filter(u=>u.active&&(u.branch===branch||u.branch==='All branches')&&!branchStaff.some(s=>s.name.trim().toLowerCase()===u.name.trim().toLowerCase()));
 const selectedPayee=branchStaff.find(s=>s.id===selectedStaff);
 const resolvePayee=async()=>{if(!selectedStaff.startsWith('login:'))return selectedStaff;const u=staffUsers.find(x=>x.id===selectedStaff.slice(6));if(!u)throw new Error('Choose a staff member');const id=await addExpenseStaff(u.name,'Shop staff','','Login staff');setSelectedStaff(id);return id};
 const closeForm=()=>{setOpen(false);setEditing(null);setAddStaffOpen(false)};
 const openNew=()=>{setEditing(null);setAmount('');setDescription('');setReference('');setExpenseDate(today());setCategory(categoryOptions[0]||'');setSelectedStaff('');setExpenseMonth(today().slice(0,7));setOpen(true)};
 const openEdit=(entry:PettyEntry)=>{setEditing(entry);setAmount(String(entry.amount));setCategory(entry.category);setDescription(entry.description);setReference(entry.reference);setExpenseDate(entry.date);setSelectedStaff(entry.staff_id||'');setExpenseMonth(entry.expense_month||today().slice(0,7));setOpen(true)};
 const save=async()=>{setBusy(true);try{const payeeId=requiresStaff?await resolvePayee():selectedStaff;const details={amount:Number(amount),category,description,reference,date:expenseDate,staff_id:payeeId,expense_month:expenseMonth};if(editing)await changeExpense(editing.id,'Save',details,mainCash);else await recordCash('Expense',Number(amount),category,description,reference,mainCash,payeeId,expenseMonth);closeForm();toast.success(editing?'Expense updated':'Expense recorded')}catch(e){toast.error(e instanceof Error?e.message:'Could not save expense')}finally{setBusy(false)}};
 const saveStaff=async()=>{setStaffBusy(true);try{const id=await addExpenseStaff(newStaffName,newStaffType,newStaffPhone,newStaffNote);setSelectedStaff(id);setNewStaffName('');setNewStaffType('Shop staff');setNewStaffPhone('');setNewStaffNote('');setAddStaffOpen(false);toast.success('Payee profile added')}catch(e){toast.error(e instanceof Error?e.message:'Could not add payee profile')}finally{setStaffBusy(false)}};
 return <>
  <PageTitle title="Expenses" subtitle={`${branches.find(b=>b.id===branch)?.name} · Expenses paid from main cash`} actions={<div className="flex gap-2"><Button variant="outline" onClick={()=>setManage(true)}><Tags/>Categories</Button><Button disabled={!categoryOptions.length||currencyLoading} onClick={openNew}><ArrowUpRight/>Add expense</Button></div>}/>
  <div className="stats-grid petty-stats"><Stat label="Total expenses" value={money(total)}/><Stat label="Expenses today" value={money(spentToday)}/></div>
  <section className="dashboard-section"><div className="dashboard-heading"><h2>Expense history</h2><span>{entries.length} records</span></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>DESCRIPTION / REFERENCE</th><th>CATEGORY</th><th>AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>{[...entries].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(e=><tr key={e.id}><td>{e.date}</td><td><b>{e.description}</b><small>{e.reference}</small>{(e.staff_name||e.expense_month)&&<small>{[e.staff_name,e.staff_type||expenseStaff.find(s=>s.id===e.staff_id)?.payee_type,e.expense_month].filter(Boolean).join(' · ')}</small>}</td><td>{e.category}</td><td className="negative">−{money(e.amount)}</td><td><div className="flex gap-1"><Button variant="ghost" size="icon" title={`Edit ${e.description}`} aria-label={`Edit ${e.description}`} onClick={()=>openEdit(e)}><Pencil/></Button><Button variant="ghost" size="icon" title={`Delete ${e.description}`} aria-label={`Delete ${e.description}`} onClick={()=>setDeleting(e)}><Trash2/></Button></div></td></tr>)}</tbody></table></div>{!entries.length&&<Empty title="No expenses recorded" description=""/>}</section>
  {open&&<Dialog open onOpenChange={closeForm}><DialogContent><DialogHeader><DialogTitle>{editing?'Edit expense':'Record expense'}</DialogTitle></DialogHeader>
   <Field label="Amount"><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
   <div className="fx-total"><span>{editing?'New expense total':'Paid from main cash'}</span><strong>{money(Number(amount)>0?Number(amount):0)}</strong></div>
   <Field label="Category"><Select value={category} onChange={value=>{setCategory(value);setSelectedStaff('')}} label="Expense category" options={categoryOptions}/></Field>
   {requiresStaff&&<Field label="Staff or payee"><div className="flex gap-2"><Select value={selectedStaff} onChange={setSelectedStaff} label="Staff or payee" options={[{value:'',label:'Choose staff or payee'},...branchStaff.map(s=>({value:s.id,label:`${s.name} · ${s.payee_type}`})),...loginStaff.map(u=>({value:`login:${u.id}`,label:`${u.name} · Shop staff`}))]}/><Button type="button" variant="outline" size="icon" title="Add payee profile" aria-label="Add payee profile" onClick={()=>setAddStaffOpen(true)}><UserPlus/></Button></div></Field>}
   {requiresStaff&&selectedPayee&&(selectedPayee.phone||selectedPayee.note)&&<div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground"><b className="text-foreground">{selectedPayee.payee_type}</b>{selectedPayee.phone&&<span className="block">{selectedPayee.phone}</span>}{selectedPayee.note&&<span className="block">{selectedPayee.note}</span>}</div>}
   {requiresMonth&&<Field label="Expense month"><Input type="month" value={expenseMonth} onChange={e=>setExpenseMonth(e.target.value)}/></Field>}
   <Field label="Description"><Input value={description} maxLength={500} onChange={e=>setDescription(e.target.value)}/></Field>
   <Field label="Reference / receipt number"><Input value={reference} maxLength={120} onChange={e=>setReference(e.target.value)}/></Field>
   {editing&&<Field label="Expense date"><Input type="date" max={today()} value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></Field>}
   <Button disabled={busy||!amount||!description.trim()||!category||(!!editing&&!expenseDate)||(requiresStaff&&!selectedStaff)||(requiresMonth&&!expenseMonth)} onClick={save}>{busy?'Saving…':editing?'Save changes':'Record expense'}</Button>
  </DialogContent></Dialog>}
  {addStaffOpen&&<Dialog open onOpenChange={setAddStaffOpen}><DialogContent><DialogHeader><DialogTitle>Add payee profile</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Add shop staff or an outside-shop contact. No login access is created.</p><Field label="Payee type"><Select value={newStaffType} onChange={value=>setNewStaffType(value as ExpensePayeeType)} label="Payee type" options={EXPENSE_PAYEE_TYPES.map(type=>({value:type,label:type}))}/></Field><Field label="Payee name"><Input value={newStaffName} maxLength={120} onChange={e=>setNewStaffName(e.target.value)}/></Field><Field label="Phone (optional)"><Input type="tel" value={newStaffPhone} maxLength={40} onChange={e=>setNewStaffPhone(e.target.value)}/></Field><Field label="Note (optional)"><Input value={newStaffNote} maxLength={500} onChange={e=>setNewStaffNote(e.target.value)}/></Field><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setAddStaffOpen(false)}>Cancel</Button><Button disabled={staffBusy||!newStaffName.trim()} onClick={saveStaff}>{staffBusy?'Adding…':'Save payee'}</Button></div></DialogContent></Dialog>}
  {deleting&&<CredentialConfirm title="Delete expense?" detail={<div className="space-y-2"><p>{deleting.description} · <b>{money(deleting.amount)}</b></p><p>This returns the amount to main cash and keeps a deletion record in Audit history.</p></div>} email={data.user?.email||''} skipCredential={data.demo===true} onClose={()=>setDeleting(null)} onConfirm={async()=>{try{await changeExpense(deleting.id,'Delete',null,mainCash);toast.success('Expense deleted and main cash updated')}catch(e){toast.error(e instanceof Error?e.message:'Could not delete expense')}finally{setDeleting(null)}}}/>}
  {manage&&<PettyCategories key={branch} onClose={()=>setManage(false)}/>}
 </>;
}
