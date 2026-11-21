import {supabaseAdmin} from '@/integrations/supabase/client.server';
import {colomboDate,parseGoldQuote} from './gold-rates';
export async function refreshGold(){
 const db=supabaseAdmin as any;const {data:cfg,error}=await db.from('kd_gold_settings').select('*').eq('id',1).single();if(error)throw new Error('Gold-rate settings unavailable');
 if(!cfg.enabled)return {skipped:true};
 const now=new Date();
 
 if(cfg.last_attempt&&now.getTime()-Date.parse(cfg.last_attempt)<300000)return {skipped:true};
 const {data:claimed,error:claimError}=await db.from('kd_gold_settings').update({last_attempt:now.toISOString(),lease_until:new Date(now.getTime()+60000).toISOString()}).eq('id',1).eq('enabled',true).or('last_attempt.is.null,last_attempt.lte.'+new Date(now.getTime()-300000).toISOString()).or('lease_until.is.null,lease_until.lt.'+now.toISOString()).select('id');
 if(claimError||!claimed?.length)return {skipped:true};
 try{
  const today = colomboDate(new Date());
  const primary = await fetchQuote('https://gold-rates.amila.info/api/gold')
    .then(data => parseGoldQuote(data, new Date())).catch(() => null);
  const fallback = primary?.sourceDate === today ? null : await fetchFallback().catch(() => null);
  const quote = fallback && (!primary || fallback.sourceDate > primary.sourceDate) ? fallback : primary;
  if (!quote) throw new Error('Neither provider returned a valid gold quote');
  if (cfg.source_date && quote.sourceDate < cfg.source_date) {
    throw new Error('Providers returned older quotes than the saved reference');
  }
  const {error:saved}=await db.rpc('kd_store_gold_quote',{p_date:quote.sourceDate,p_prices:quote.prices});if(saved)throw new Error('Could not save reference rates');
  return {ok:true};
 }catch(error){
  const message=error instanceof Error?error.message:'Rate fetch failed';
  await db.from('kd_gold_settings').update({last_error:message,lease_until:null}).eq('id',1);
  return {ok:false,error:message};
 }
}

async function fetchQuote(url: string) {
  const response = await fetch(url, {headers:{Accept:'application/json'}, signal:AbortSignal.timeout(10000), redirect:'error'});
  if (!response.ok) throw new Error('Reference provider unavailable (HTTP ' + response.status + ')');
  const body = await response.text();
  if (body.length > 65536) throw new Error('Unexpected provider response');
  return JSON.parse(body);
}

async function fetchFallback() {
  const data = await fetchQuote('https://www.goldpricetoday.lk/api/v1/gold-price');
  if (data?.status !== 'ok' || data.currency !== 'LKR' || typeof data.as_of !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(data.as_of)) {
    throw new Error('Invalid fallback quote');
  }
  const published = new Date(data.as_of);
  if (!Number.isFinite(published.getTime()) || published > new Date()) throw new Error('Invalid fallback publication time');
  const prices = Object.fromEntries(['18K','21K','22K','24K'].map(purity => {
    const amount = data.prices?.[purity.toLowerCase()]?.per_8g;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0.04 || amount > 1e12) {
      throw new Error('Invalid fallback rate for ' + purity);
    }
    return [purity, amount];
  }));
  return {sourceDate: colomboDate(published), prices: {...prices, provider:'fallback', published_at:published.toISOString()}};
}
