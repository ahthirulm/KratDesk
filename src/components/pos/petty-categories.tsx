import {useState} from 'react';
import {Plus,Pencil,Trash2,Save} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {usePos} from './data';
import {Field,CredentialConfirm,Empty} from './shared';
import type {PettyCategory} from '@/lib/petty-categories';

export function PettyCategories({onClose}:{onClose:()=>void}){
 const {data,branch,pettyCategories,pettyEntries,managePettyCategory}=usePos();
 const [edit,setEdit]=useState<PettyCategory|null>(null);
 const [name,setName]=useState('');
 const [requiresStaff,setRequiresStaff]=useState(false);
 const [requiresMonth,setRequiresMonth]=useState(false);
 const [remove,setRemove]=useState<PettyCategory|null>(null);
 const [busy,setBusy]=useState(false);
 const categories=pettyCategories.filter(c=>c.branch_id===branch);
 const reset=()=>{setEdit(null);setName('');setRequiresStaff(false);setRequiresMonth(false)};
 const openEdit=(category:PettyCategory)=>{setEdit(category);setName(category.name);setRequiresStaff(category.requires_staff===true);setRequiresMonth(category.requires_month===true)};
 const updateName=(value:string)=>{setName(value);if(!edit&&['salary','salaries'].includes(value.trim().toLowerCase())){setRequiresStaff(true);setRequiresMonth(true)}};
 async function save(){setBusy(true);try{await managePettyCategory(edit?.id||null,name,{requires_staff:requiresStaff,requires_month:requiresMonth});reset();toast.success(edit?'Category updated':'Category added')}catch(e){toast.error(e instanceof Error?e.message:'Could not save category')}finally{setBusy(false)}}
 return <><Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>Expense categories</DialogTitle></DialogHeader>
  <form className="entry-form" onSubmit={e=>{e.preventDefault();void save()}}>
   <Field label={edit?'Category name':'New category'}><Input aria-label="Expense category name" value={name} onChange={e=>updateName(e.target.value)}/></Field>
   <p className="text-sm text-muted-foreground">Choose which extra details this category needs.</p>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresStaff} onChange={e=>setRequiresStaff(e.target.checked)}/>User / payee required</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresMonth} onChange={e=>setRequiresMonth(e.target.checked)}/>Month required</label>
   <div className="flex gap-2"><Button type="submit" disabled={busy||!name.trim()}>{edit?<Save/>:<Plus/>}{edit?'Save category':'Add category'}</Button>{edit&&<Button type="button" variant="outline" onClick={reset}>Cancel</Button>}</div>
  </form>
  <div className="max-h-80 overflow-y-auto">{categories.map(c=>{const used=pettyEntries.some(e=>e.category_id===c.id||(e.branch_id===branch&&e.kind==='Expense'&&e.category===c.name));const details=[c.requires_staff?'User / payee':'',c.requires_month?'Month':''].filter(Boolean).join(' · ');return <div className="settings-metal" key={c.id}><span>{c.name}<small className="block text-xs text-muted-foreground">{details||'No extra details'}</small></span><div className="flex gap-1"><Button variant="ghost" size="icon" title={`Edit ${c.name}`} aria-label={`Edit ${c.name}`} onClick={()=>openEdit(c)}><Pencil/></Button><Button variant="ghost" size="icon" disabled={used} title={used?'Used by recorded expenses':`Remove ${c.name}`} aria-label={`Remove ${c.name}`} onClick={()=>setRemove(c)}><Trash2/></Button></div></div>})}{!categories.length&&<Empty title="No expense categories" description=""/>}</div>
 </DialogContent></Dialog>{remove&&<CredentialConfirm title="Remove expense category?" detail={<p>{remove.name}</p>} email={data.user?.email||''} skipCredential={data.demo===true} onClose={()=>setRemove(null)} onConfirm={async()=>{try{await managePettyCategory(remove.id,null);toast.success('Category removed')}catch(e){toast.error(e instanceof Error?e.message:'Could not remove category')}finally{setRemove(null)}}}/>}</>;
}
