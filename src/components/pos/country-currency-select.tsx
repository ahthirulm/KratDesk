import {useState} from 'react';
import {Check,ChevronsUpDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Command,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {COUNTRY_CURRENCIES,currencyDetails,type CountryCurrency} from '@/lib/country-currencies';

export function CountryCurrencySelect({code,onSelect}:{code:string;onSelect:(option:CountryCurrency)=>void}){
 const [open,setOpen]=useState(false);
 const [selected,setSelected]=useState<CountryCurrency|undefined>(()=>currencyDetails(code));
 const current=selected?.code===code?selected:currencyDetails(code);
 function choose(option:CountryCurrency){
  if(option.code==='LKR')return;
  setSelected(option);onSelect(option);setOpen(false);
 }
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Country and currency" className="country-currency-trigger">
   {current?<><span className="country-flag" aria-hidden="true">{current.flag}</span><span className="country-currency-label"><strong>{current.country}</strong><small>{current.code} · {current.name}</small></span><span className="currency-symbol">{current.symbol}</span></>:<span className="country-currency-placeholder">Choose a country or currency</span>}
   <ChevronsUpDown className="country-currency-chevron"/>
  </Button></PopoverTrigger>
  <PopoverContent align="start" className="country-currency-popover">
   <Command><CommandInput placeholder="Search country, currency, code or symbol…"/><CommandList><CommandEmpty>No country or currency found.</CommandEmpty><CommandGroup>{COUNTRY_CURRENCIES.map(option=><CommandItem key={option.id} value={`${option.country} ${option.code} ${option.name} ${option.symbol}`} disabled={option.code==='LKR'} onSelect={()=>choose(option)} className="country-currency-option">
    <span className="country-flag" aria-hidden="true">{option.flag}</span><span className="currency-symbol">{option.symbol}</span><span className="country-currency-label"><strong>{option.country}</strong><small>{option.code} · {option.name}{option.code==='LKR'?' · Main currency':''}</small></span>{current?.id===option.id&&<Check className="country-currency-check"/>}
   </CommandItem>)}</CommandGroup></CommandList></Command>
  </PopoverContent>
 </Popover>;
}
