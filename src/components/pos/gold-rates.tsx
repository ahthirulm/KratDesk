import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {useState} from 'react';
import {toast} from 'sonner';
import {Clock3,RefreshCw,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {getGoldRates,setGoldEnabled,fetchGoldRates,applyGoldRates} from '@/lib/gold-rates.functions';
import {colomboDate} from '@/lib/gold-rates';
import {money} from '@/lib/pos-rules';
import {usePos} from './data';

function time(v:string|null|undefined){return v?new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Colombo'}):'Never';}
export function GoldRates({settings=false}:{settings?:boolean}){
 const {data,refresh}=usePos();const get=useServerFn(getGoldRates),toggle=useServerFn(setGoldEnabled),fetchLatest=useServerFn(fetchGoldRates),apply=useServerFn(applyGoldRates);
 const q=useQuery({queryKey:['gold-rates'],queryFn:()=>get(),enabled:data.admin&&!data.demo,staleTime:60000});const [busy,setBusy]=useState(false);
 async function run(fn:()=>Promise<any>){setBusy(true);try{const result=await fn();if(result?.error)throw new Error(result.error);await q.refetch();await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Unable to update rates');}finally{setBusy(false);}}
 if(!data.admin||data.demo)return null;
 if(q.isError)return <p role="alert">Rate integration unavailable. Manual entry remains available.</p>;
 const cfg=q.data?.settings;if(!cfg)return <p>Loading rate settings…</p>;
 const isFallback=cfg.prices?.provider==='fallback';const stale=cfg.source_date!==colomboDate();
 if(settings)return <div className="integration-settings"><label className="check-row"><input type="checkbox" checked={cfg.enabled} disabled={busy} onChange={e=>run(()=>toggle({data:{enabled:e.target.checked}}))}/>Enable hourly reference-rate fetching</label><p>Gold Rates LKR with Gold Price Today Sri Lanka as fallback · 18K, 21K, 22K and 24K · per pawn (8 grams). Checks hourly using Asia/Colombo time. Valid quotes apply automatically when prices change.</p><p>Manual entry works with this setting on or off. Third-party reference rates are not your shop’s selling prices. Provider usage terms have not been confirmed; review them before enabling.</p><a className="integration-link" href="https://gold-rates.amila.info/" target="_blank" rel="noreferrer">Provider documentation</a></div>;
 const purityCards=['18K','21K','22K','24K'].map(purity=>({purity,value:cfg.prices?.[purity]??(cfg.prices?.['24K']?cfg.prices['24K']*Number(purity.slice(0,2))/24:null)}));
 return <><section className="dashboard-section integration-panel">
  <div className="integration-heading"><div><span className="eyebrow">MARKET REFERENCE</span><h2>{isFallback?'Gold Price Today Sri Lanka · Fallback':'Third-party reference rates · Gold Rates LKR'}</h2><p>Indicative market rates, separate from your shop’s final selling prices.</p></div><span className={`badge ${cfg.last_error?'danger':cfg.enabled?'success':'neutral'}`}>{cfg.last_error?'Check connection':cfg.enabled?'Automatic on':'Automatic off'}</span></div>
  <div className="integration-meta"><span><Clock3 size={14}/>Published: {(isFallback?time(cfg.prices?.published_at)+' (Colombo)':cfg.source_date)||'Not available'}</span><span>Last successful fetch: {time(cfg.last_success)} (Colombo)</span></div>
  {cfg.last_error&&<p className="integration-alert" role="alert">{cfg.last_error}. Last valid reference and selling rates retained.</p>}
  {cfg.prices&&<><div className="rate-reference-grid">{purityCards.map(item=><div key={item.purity}><span>{item.purity} {!isFallback&&['18K','21K'].includes(item.purity)&&<small>estimate</small>}</span><strong>{item.value===null?'—':money(item.value)}</strong><small>per pawn · 8 grams</small></div>)}</div><p className="integration-note">{stale?'Using an older valid published reference until a newer quote is available. Silver stays manual.':'New or changed quotes update today’s four gold selling rates automatically. Enter silver manually.'}</p></>}
  {!cfg.enabled&&<p className="integration-note">Automatic fetching is off. Enable it in Shop settings when ready.</p>}
  <div className="integration-actions"><Button disabled={busy||!cfg.enabled} variant="outline" onClick={()=>run(async()=>{const result=await fetchLatest();if('skipped' in result)toast.info('No new request sent. Check that fetching is on and wait five minutes between requests.');else if(result.ok)toast.success('Reference refreshed. Changed rates are saved automatically.');return result;})}><RefreshCw/>Fetch latest rates</Button><Button disabled={busy||!cfg.enabled||!cfg.prices} onClick={()=>run(()=>apply())}><ShieldCheck/>Apply rates</Button></div>
 </section>
 <section className="dashboard-section"><div className="dashboard-heading"><div><h2>Rate history</h2><p>Latest 200 applied selling-rate changes, including multiple changes on the same day.</p></div><span>Asia/Colombo</span></div><div className="table-scroll"><table><thead><tr><th>Changed</th><th>Rate date</th><th>Metal</th><th>Previous / pawn</th><th>New / pawn</th><th>Source</th><th>Applied by</th><th>Published</th></tr></thead><tbody>{q.data.history.map((h:any)=><tr key={h.id}><td>{time(h.changed_at)}</td><td>{h.rate_date}</td><td>{data.metals.find(m=>m.id===h.metal_id)?.name||'Metal'}</td><td>{h.old_pawn===null?'—':money(h.old_pawn)}</td><td>{money(h.new_pawn)}</td><td>{h.source}</td><td>{q.data.profiles.find((p:any)=>p.id===h.applied_by)?.display_name||'System / historical'}</td><td>{h.source_date||'—'}</td></tr>)}</tbody></table></div>{!q.data.history.length&&<p className="integration-note">No changes recorded since this upgrade.</p>}
 <details className="account-movements"><summary>Fetched reference-rate history <span>(not applied)</span></summary><div className="table-scroll"><table><thead><tr><th>Fetched (Colombo)</th><th>Published</th><th>22K / pawn</th><th>24K / pawn</th></tr></thead><tbody>{q.data.fetched.map((h:any)=><tr key={h.id}><td>{time(h.fetched_at)}</td><td>{h.source_date}</td><td>{money(h.prices['22K'])}</td><td>{money(h.prices['24K'])}</td></tr>)}</tbody></table></div></details></section></>;
}
