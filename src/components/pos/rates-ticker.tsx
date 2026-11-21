import {Link} from '@tanstack/react-router';
import {TrendingUp} from 'lucide-react';
import {usePos} from './data';
import {money} from '@/lib/pos-rules';

// Running rate strip shown at the top of the dashboard: today's rate per metal.
export function RatesTicker(){
 const {data,rate}=usePos();
 const pound=data.settings.pricing_unit==='Pound (8g)';
 if(!data.metals.length)return null;
 const copy=<div className="rates-ticker-copy">{data.metals.map(m=><span className="rates-ticker-item" key={m.id}>
   <b>{m.name}</b>
   <span className={rate(m.id)?'rate':'missing'}>{rate(m.id)?money(rate(m.id)*(pound?8:1)):'No rate today'}</span>
   </span>)}</div>;
 return <div className="rates-ticker">
  <span className="rates-ticker-label"><TrendingUp/>Today’s rates</span>
  <div className="rates-ticker-view"><div className="rates-ticker-track" style={{animationDuration:`${Math.max(20,data.metals.length*9)}s`}}>{copy}{copy}</div></div>
  <Link className="rates-ticker-more" to="/rates">All rates</Link>
 </div>;
}
