import {useServerFn} from '@tanstack/react-start';
import {getHostHealth} from '@/lib/host-health.functions';
import {useQuery} from '@tanstack/react-query';
import {RefreshCw,Database,HardDrive,TriangleAlert,Activity} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {PageTitle,Stat,Empty} from './shared';
type Health={checked_at:string;postgres_version:string;db_size_bytes:number;started_at:string;connections:number;active_queries:number;max_connections:number;cache_hit_pct:number|null;deadlocks:number;rollbacks:number;commits:number;tables:{name:string;rows:number;bytes:number;dead_rows:number;last_vacuum:string|null}[];storage:{bucket:string;files:number;bytes:number;last_upload:string}[];recent_uploads:{bucket:string;name:string;bytes:number|null;type:string|null;created_at:string}[];errors_24h:number;audit_24h:number;audit_by_day:{day:string;events:number}[]};
export const bytes=(n:number|null|undefined)=>{const v=Number(n||0);if(v<1024)return `${v} B`;const u=['KB','MB','GB','TB'];let x=v/1024,i=0;while(x>=1024&&i<u.length-1){x/=1024;i++}return `${x.toFixed(x<10?1:0)} ${u[i]}`};
const when=(s:string|null)=>s?new Date(s).toLocaleString('en-GB',{timeZone:'Asia/Colombo',dateStyle:'medium',timeStyle:'short'}):'—';
const label=(t:string)=>t.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
export function SystemHealth(){
 const {data}=usePos();
 const health=useQuery({queryKey:['system-health'],enabled:data.owner,refetchInterval:60000,queryFn:async()=>{const {data,error}=await supabase.rpc('system_health');if(error)throw error;return data as unknown as Health}});
 const loadHost=useServerFn(getHostHealth);
 const hostQuery=useQuery({queryKey:['host-health',data.user?.id],enabled:data.owner,refetchInterval:60000,retry:false,queryFn:()=>loadHost()});
 const host=hostQuery.data?.host;
 const hostFields: [string, string | false | null | undefined][]=[
  ['KaratDesk version',hostQuery.data?.version],
  ['Hosting provider',hostQuery.data?.provider],
  ['Region',hostQuery.data?.region],
  ['Hardware model',host?.model],
  ['Operating system',host?.os],
  ['Battery',host&&(host.battery&&!host.battery.present?'No battery detected':host.battery?.capacity!=null&&`${host.battery.capacity}%`)],
  ['Battery state',host&&(host.battery&&!host.battery.present?'No battery detected':host.battery?.state)],
  ['Charger',host?.battery?.charger],
  ['Uptime',host&&`${Math.floor(host.uptime/3600)} h ${Math.floor(host.uptime/60)%60} min`],
  ['CPU (1-minute load / cores)',host&&`${host.cpuLoad.toFixed(2)} / ${host.cores}`],
  ['RAM used',host&&host.ramAvailable!==null&&`${bytes(host.ram-host.ramAvailable)} / ${bytes(host.ram)}`],
  ['Storage available (app data)',host?.disk!=null&&host.diskFree!=null&&`${bytes(host.diskFree)} / ${bytes(host.disk)}`],
 ];
 const errors=useQuery({queryKey:['app-errors'],enabled:data.owner,refetchInterval:60000,queryFn:async()=>{const {data,error}=await supabase.from('app_errors').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data}});
 if(!data.owner)return <Empty title="Super Admin access required" description="Only the owner account can see system health."/>;
 const h=health.data;const refresh=()=>{void health.refetch();void errors.refetch();void hostQuery.refetch()};
 const status=!h?'Checking…':h.errors_24h>10||h.connections/h.max_connections>0.8?'Needs attention':'Healthy';
 const maxDay=Math.max(1,...(h?.audit_by_day||[]).map(d=>d.events));
 return <><PageTitle title="System health" subtitle={h?`Status: ${status} · Checked ${when(h.checked_at)} · Refreshes every minute`:'Owner-only server, error and storage details'} actions={<Button variant="outline" onClick={refresh}><RefreshCw/>Refresh</Button>}/>
 {hostQuery.error&&<p className="text-sm text-muted-foreground">Server readings unavailable: {hostQuery.error.message}</p>}
 {health.error&&<Empty title="Could not load health" description={health.error.message}/>}
 <section className="dashboard-section"><div className="dashboard-heading"><h2>Server details</h2></div><dl className="health-grid">{hostFields.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value||"Unavailable"}</dd></div>)}</dl></section>
 {h&&<>
 <div className="stats-grid"><Stat label="Database size" value={bytes(h.db_size_bytes)}/><Stat label="Connections" value={`${h.connections} / ${h.max_connections}`}/><Stat label="Errors (24h)" value={String(h.errors_24h)}/><Stat label="Activity (24h)" value={String(h.audit_24h)}/></div>
 <section className="dashboard-section"><div className="dashboard-heading"><h2><Database size={16} className="inline mr-2"/>Server</h2></div><dl className="health-grid">{([['Status',status],['Database version',h.postgres_version],['Running since',when(h.started_at)],['Active queries',h.active_queries],['Cache hit rate',h.cache_hit_pct==null?'—':`${h.cache_hit_pct}%`],['Successful saves',h.commits.toLocaleString()],['Cancelled saves',h.rollbacks.toLocaleString()],['Deadlocks',h.deadlocks]] as const).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
 <section className="dashboard-section"><div className="dashboard-heading"><h2><Activity size={16} className="inline mr-2"/>Activity, last 14 days</h2></div><div className="health-bars">{h.audit_by_day.map(d=><div key={d.day} title={`${d.day}: ${d.events}`}><span style={{height:`${Math.max(4,d.events/maxDay*100)}%`}}/><small>{d.day.slice(8)}</small></div>)}{!h.audit_by_day.length&&<p className="text-sm text-muted-foreground">No activity yet.</p>}</div></section>
 <section className="dashboard-section"><div className="dashboard-heading"><h2><TriangleAlert size={16} className="inline mr-2"/>Error log</h2><span>{errors.data?.length||0} latest</span></div><div className="table-scroll"><table><thead><tr><th>TIME</th><th>ERROR</th><th>PAGE</th><th>USER</th></tr></thead><tbody>{(errors.data||[]).map(e=><tr key={e.id}><td>{when(e.created_at)}</td><td><b>{e.message}</b>{e.detail&&<details><summary className="text-xs text-muted-foreground cursor-pointer">Technical details</summary><pre className="text-xs whitespace-pre-wrap break-all">{e.detail}</pre></details>}<small>{e.source} · {e.user_agent.split(') ')[0]?.split('(')[1]||''}</small></td><td>{e.url}</td><td>{data.staff.find(s=>s.id===e.user_id)?.display_name||'User'}</td></tr>)}</tbody></table></div>{!errors.data?.length&&<Empty title="No errors recorded" description="Screen errors users encounter will appear here."/>}</section>
 <section className="dashboard-section"><div className="dashboard-heading"><h2><HardDrive size={16} className="inline mr-2"/>File storage</h2></div><div className="table-scroll"><table><thead><tr><th>FOLDER</th><th>FILES</th><th>SIZE</th><th>LAST UPLOAD</th></tr></thead><tbody>{h.storage.map(s=><tr key={s.bucket}><td>{label(s.bucket)}</td><td>{s.files}</td><td>{bytes(s.bytes)}</td><td>{when(s.last_upload)}</td></tr>)}</tbody></table></div>{!h.storage.length&&<Empty title="No files stored" description=""/>}
 {h.recent_uploads.length>0&&<><div className="dashboard-heading"><h2>Upload history</h2></div><div className="table-scroll"><table><thead><tr><th>TIME</th><th>FOLDER</th><th>FILE</th><th>TYPE</th><th>SIZE</th></tr></thead><tbody>{h.recent_uploads.map(u=><tr key={u.bucket+u.name}><td>{when(u.created_at)}</td><td>{label(u.bucket)}</td><td className="break-all">{u.name.split('/').pop()}</td><td>{u.type||'—'}</td><td>{bytes(u.bytes)}</td></tr>)}</tbody></table></div></>}</section>
 <section className="dashboard-section"><div className="dashboard-heading"><h2>Records by area</h2><span>{h.tables.length} areas</span></div><div className="table-scroll"><table><thead><tr><th>AREA</th><th>RECORDS</th><th>SIZE</th><th>LAST CLEAN-UP</th></tr></thead><tbody>{h.tables.map(t=><tr key={t.name}><td>{label(t.name)}</td><td>{t.rows.toLocaleString()}</td><td>{bytes(t.bytes)}</td><td>{when(t.last_vacuum)}</td></tr>)}</tbody></table></div></section>
 </>}</>;
}
