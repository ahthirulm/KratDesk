import {GoldRates} from './gold-rates';
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Printer, Upload, Save, Plus, Trash2, Store, ShieldCheck, Smartphone, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePos } from './data';
import { Fold, FoldGroup } from './fold';
import { PageTitle, Field, Select, CredentialConfirm } from './shared';
import type { PricingUnit } from '@/lib/pos-rules';
import { supabase } from '@/integrations/supabase/client';
import { INACTIVITY_OPTIONS, validateInactivityMinutes } from '@/lib/security-rules';

export function Settings() {
  const { data, refresh, savePricingUnit } = usePos();
  const [form, setForm] = useState(data.settings);
  const [pricing, setPricing] = useState<PricingUnit>(data.settings.pricing_unit);
  const [metal, setMetal] = useState('');
  const [del, setDel] = useState<string | null>(null);
  useEffect(() => { setForm(data.settings); setPricing(data.settings.pricing_unit); }, [data.settings.shop_name,data.settings.address,data.settings.phone,data.settings.currency,data.settings.country,data.settings.pricing_unit,data.settings.inactivity_minutes,data.settings.print_logo,data.settings.print_paper,data.settings.print_header,data.settings.print_footer,data.settings.print_show_address,data.settings.print_show_phone,data.settings.print_show_customer_phone]);

  async function persist(message: string) {
    if (data.demo) { toast.info('Sample preview only. Live settings remain unchanged.'); return; }
    try {
      if (!form.shop_name.trim()) throw new Error('Shop name is required');
      validateInactivityMinutes(Number(form.inactivity_minutes));
      const { error } = await supabase.from('settings').upsert({ id: true, ...form, inactivity_minutes: Number(form.inactivity_minutes) });
      if (error) throw error;
      await refresh();
      toast.success(message);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save settings'); }
  }

  return <>
    <PageTitle title="Settings" subtitle="Shop details, billing preferences and user session security." />
    <FoldGroup title="Shop">
    <Fold defaultOpen title="Shop setup" note="Name, address, country and currency" icon={<Store />}><div className="entry-form">
      <Field label="Shop name"><Input value={form.shop_name} onChange={(event) => setForm({ ...form, shop_name: event.target.value })} /></Field>
      <Field label="Address"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
      <div className="form-grid"><Field label="Country"><Input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
        <Field label="Currency label"><Input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></Field></div>
      <Button onClick={() => void persist('Shop details saved')}><Save />Save shop details</Button>
    </div></Fold>

    <Fold title="Bill printing" note="Logo, paper size, header, footer and contacts" icon={<Printer />}><div className="entry-form">
      <Fold sub defaultOpen title="Logo & paper">
      <Field label="Shop logo"><div className="print-settings-logo">{form.print_logo?<img src={form.print_logo} alt="Shop logo preview"/>:<span className="muted-small">No logo</span>}<Button asChild variant="outline"><label><Upload />Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (event) => { const file = event.target.files?.[0]; event.target.value=''; if (!file) return; try { setForm({ ...form, print_logo: await shrinkLogo(file) }); } catch { toast.error('Could not read this image'); } }} /></label></Button>{form.print_logo&&<Button variant="ghost" onClick={() => setForm({ ...form, print_logo: null })}><Trash2 />Remove</Button>}</div></Field>
      <div className="form-grid"><Field label="Paper size"><Select label="Paper size" value={form.print_paper||'80mm'} onChange={(value) => setForm({ ...form, print_paper: value })} options={[{value:'58mm',label:'58mm thermal roll'},{value:'80mm',label:'80mm thermal roll'},{value:'A5',label:'A5 sheet'},{value:'A4',label:'A4 sheet'}]} /></Field>
        <Field label="Extra header line"><Input maxLength={200} placeholder="e.g. Registered jeweller · Since 1995" value={form.print_header||''} onChange={(event) => setForm({ ...form, print_header: event.target.value })} /></Field></div>
      <Field label="Footer message"><Input maxLength={300} value={form.print_footer||''} onChange={(event) => setForm({ ...form, print_footer: event.target.value })} /></Field>
      </Fold>
      <Fold sub title="What to show on bills">
      <label className="check-row"><input type="checkbox" checked={form.print_show_address!==false} onChange={(event) => setForm({ ...form, print_show_address: event.target.checked })} />Show shop address</label>
      <label className="check-row"><input type="checkbox" checked={form.print_show_phone!==false} onChange={(event) => setForm({ ...form, print_show_phone: event.target.checked })} />Show shop phone</label>
      <label className="check-row"><input type="checkbox" checked={form.print_show_customer_phone!==false} onChange={(event) => setForm({ ...form, print_show_customer_phone: event.target.checked })} />Show customer phone on bills</label>
      </Fold>
      <Button onClick={() => void persist('Bill printing saved')}><Save />Save bill printing</Button>
    </div></Fold>

    <Fold title="Billing prices" note="Price per pound (8g) or per gram" icon={<Save />}><div className="entry-form"><Field label="Price unit"><Select label="Price unit" value={pricing} onChange={(value) => setPricing(value === 'Gram' ? 'Gram' : 'Pound (8g)')} options={['Pound (8g)', 'Gram']} /></Field>
      <Button onClick={async () => { try { await savePricingUnit(pricing); toast.success('Pricing preference saved'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save pricing preference'); } }}><Save />Save pricing preference</Button>
    </div></Fold>

    </FoldGroup>
    <FoldGroup title="Security">
    <Fold title="Sign-in security" note="Inactivity logout and two-factor" icon={<ShieldCheck />}><div className="entry-form">
      <Fold sub defaultOpen title="Inactivity logout">
      <div className="security-setting"><TimerReset /><div><h3>Inactivity logout</h3><p>Signed-in staff are logged out after this much time without keyboard, touch or pointer activity. The default is one hour.</p></div></div>
      <Field label="Sign out after inactivity"><Select label="Sign out after inactivity" value={String(form.inactivity_minutes)} onChange={(value) => setForm({ ...form, inactivity_minutes: Number(value) })} options={INACTIVITY_OPTIONS.map((minutes) => ({ value: String(minutes), label: minutes < 60 ? `${minutes} minutes` : minutes === 60 ? '1 hour' : minutes === 120 ? '2 hours' : minutes === 240 ? '4 hours' : '8 hours' }))} /></Field>
      <Button onClick={() => void persist('Session timeout saved')}><Save />Save session timeout</Button>
      </Fold>
      <Fold sub title="Authenticator 2FA">
      <div className="security-setting"><Smartphone /><div><h3>Optional authenticator 2FA</h3><p>Control 2FA for each person in User management. Staff scan their own QR code and manage their authenticator in Profile & security.</p></div></div>
      <Button asChild variant="outline"><Link to="/profile"><Smartphone />Open my security settings</Link></Button>
      </Fold>
    </div></Fold>

    </FoldGroup>
    <FoldGroup title="Stock">
    <Fold title="Metal types" note="Gold, silver and other metals" icon={<Plus />}><div className="entry-form"><div className="flex gap-2"><Input placeholder="New metal type" aria-label="New metal type" value={metal} onChange={(event) => setMetal(event.target.value)} />
      <Button onClick={async () => {
        if (data.demo) { toast.info('Sample preview only. Live metals remain unchanged.'); return; }
        if (!metal.trim()) return;
        const { error } = await supabase.rpc('manage_metal',{p:{name:metal.trim()}});
        if (error) toast.error(error.message); else { setMetal(''); await refresh(); toast.success('Metal added'); }
      }}><Plus />Add</Button></div>
      {data.metals.map((item) => <div className="settings-metal" key={item.id}><span>{item.name}</span><Button variant="ghost" size="icon" title="Remove metal" onClick={() => setDel(item.id)}><Trash2 /></Button></div>)}
    </div></Fold>
    </FoldGroup>
    <FoldGroup title="Integrations">
    <Fold title="Automatic gold-rate fetching" note="Hourly reference rates with manual selling-price control"><GoldRates settings /></Fold>
    </FoldGroup>
    {del && <CredentialConfirm title="Remove metal type?" detail={<p>Metal types linked to stock or rates cannot be removed.</p>} email={data.user?.email || ''} skipCredential={data.demo === true} onClose={() => setDel(null)} onConfirm={async () => {
      if (data.demo) { toast.info('Sample preview only. Live metals remain unchanged.'); setDel(null); return; }
      const { error } = await supabase.rpc('manage_metal',{p:{id:del,action:'Remove'}});
      if (error) toast.error(error.message); else { await refresh(); toast.success('Metal removed'); }
      setDel(null);
    }} />}
  </>;
}

function shrinkLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const scale = Math.min(1, 400 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); const out = c.toDataURL('image/png'); out.length > 400000 ? reject(new Error('too large')) : resolve(out); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
