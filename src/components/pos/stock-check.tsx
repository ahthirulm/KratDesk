import {useEffect,useMemo,useRef,useState} from 'react';
import {ScanLine,RotateCcw,CheckCircle2,TriangleAlert,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {usePos} from './data';
import {PageTitle,Stat,Empty} from './shared';
import {stockCheck} from '@/lib/stock-check';
import {formatWeight} from '@/lib/pos-rules';
// Counts are kept on this device only, so an interrupted count can be resumed; nothing changes stock records.
export function StockCheck(){
 const {data,allData,branch,branches}=usePos();const key=`karatdesk-stock-check-${branch}`;const [scans,setScans]=useState<string[]>([]);const [code,setCode]=useState('');const [tab,setTab]=useState<'missing'|'found'|'extra'>('missing');const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{setScans(JSON.parse(localStorage.getItem(key)||'[]'))}catch{setScans([])}},[key]);
 const save=(next:string[])=>{setScans(next);try{localStorage.setItem(key,JSON.stringify(next))}catch{}};
 const r=useMemo(()=>stockCheck(data.items.filter(i=>i.branch_id===branch),scans),[data.items,branch,scans]);
 const add=()=>{const c=code.trim();if(!c)return;save([...scans,c]);setCode('');input.current?.focus()};
 const remove=(c:string)=>{const n=scans.map(s=>s.trim().toUpperCase()).lastIndexOf(c);if(n>=0)save(scans.filter((_,k)=>k!==n))};
 const rows=tab==='missing'?r.missing:tab==='found'?r.found:[];
 return <><PageTitle title="Stock check" subtitle={`${branches.find(b=>b.id===branch)?.name||''} · Scan every piece on the shelf`} actions={<Button variant="outline" disabled={!scans.length} onClick={()=>{if(confirm('Start a new count? Scans so far will be cleared.'))save([])}}><RotateCcw/>New count</Button>}/>
 <section className="dashboard-section"><form className="flex gap-2" onSubmit={e=>{e.preventDefault();add()}}><Input ref={input} autoFocus value={code} onChange={e=>setCode(e.target.value)} placeholder="Scan or type a shop tag or system tag #" aria-label="Scan tag"/><Button type="submit"><ScanLine/>Add</Button></form><p className="text-sm text-muted-foreground mt-2">Scans are saved on this device until you start a new count. Stock records are not changed.</p></section>
 <div className="stats-grid"><Stat label="Expected in stock" value={r.expected}/><Stat label="Found" value={r.found.length} icon={<CheckCircle2/>}/><Stat label="Missing" value={r.missing.length} icon={<TriangleAlert/>}/><Stat label="Extra / not in stock" value={r.extra.length}/></div>
 <section className="dashboard-section"><div className="dashboard-periods" role="group">{([['missing',`Missing (${r.missing.length})`],['found',`Found (${r.found.length})`],['extra',`Extra (${r.extra.length})`]] as const).map(([id,l])=><Button key={id} variant={tab===id?'default':'outline'} onClick={()=>setTab(id)}>{l}</Button>)}</div>
 {tab==='extra'?(r.extra.length?<div className="table-scroll"><table><thead><tr><th>SCANNED TAG</th><th>REASON</th><th/></tr></thead><tbody>{r.extra.map(c=>{const it=allData.items.find(i=>i.tag_id.toUpperCase()===c||i.system_tag.toUpperCase()===c);return <tr key={c}><td><b>{c}</b></td><td>{it?(it.branch_id!==branch?`Belongs to ${branches.find(b=>b.id===it.branch_id)?.name||'another branch'}`:`Marked ${it.status}`):'Tag not found'}</td><td><Button size="icon" variant="ghost" aria-label={`Remove ${c}`} onClick={()=>remove(c)}><X/></Button></td></tr>})}</tbody></table></div>:<Empty title="No extra tags" description=""/>)
 :rows.length?<div className="table-scroll"><table><thead><tr><th>SHOP TAG</th><th>SYSTEM TAG #</th><th>ITEM</th><th>WEIGHT</th>{tab==='found'&&<th/>}</tr></thead><tbody>{rows.map(i=><tr key={i.id}><td><b>{i.tag_id}</b></td><td>{i.system_tag}</td><td>{i.name}</td><td>{formatWeight(i.weight)}</td>{tab==='found'&&<td><Button size="icon" variant="ghost" aria-label={`Remove ${i.tag_id}`} onClick={()=>{const n=[...scans].reverse().findIndex(s=>[i.tag_id,i.system_tag].map(x=>x.toUpperCase()).includes(s.trim().toUpperCase()));if(n>=0)save(scans.filter((_,k)=>k!==scans.length-1-n))}}><X/></Button></td>}</tr>)}</tbody></table></div>:<Empty title={tab==='missing'?'Nothing missing':'No pieces scanned yet'} description=""/>}</section></>;
}
