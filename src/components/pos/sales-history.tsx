import {displayReference} from '@/lib/display-reference';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CredentialConfirm, Empty, Field, PageTitle, SearchBox, Select, Stat } from './shared';
import { usePos, type Store } from './data';
import { Invoice } from './billing';
import { money, round } from '@/lib/pos-rules';
import { paymentTypeLabel } from '@/lib/payment-labels';
import { reversalAllocation, reversalTotals, saleDeletionBlock, saleLifecycleStatus } from '@/lib/sale-lifecycle';

type Sale = Store['sales'][number];

function ReturnPieces({ sale, lines, onClose }: { sale: Sale; lines: Store['lines']; onClose: () => void }) {
  const { rawData, saleReversals, reverseSale, data } = usePos();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('Cash');
  const [review, setReview] = useState(false);
  const amount = round(lines.filter(line => selected.includes(line.id)).reduce((sum, line) => sum + line.final_price, 0));
  const loan = rawData.loans.find(row => row.sale_id === sale.id);
  const allocation = reversalAllocation({ sale, loan, payments: rawData.payments, reversals: saleReversals, amount });
  if (review) return <CredentialConfirm title={`Return ${selected.length} ${selected.length === 1 ? 'piece' : 'pieces'}?`} email={data.user?.email || ''} skipCredential={data.demo === true} onClose={() => setReview(false)} detail={<div className="space-y-2"><p>{displayReference(sale.invoice_no)} · return value <b>{money(amount)}</b></p><p>Estimated refund: <b>{money(allocation.refund)}</b>{allocation.loanReduction > 0 && <> · loan reduction <b>{money(allocation.loanReduction)}</b></>}</p><p className="text-sm text-muted-foreground">The original invoice stays in history. Returned pieces go back to stock.</p></div>} onConfirm={async () => { try { await reverseSale(sale.id, 'Return', selected, reason, allocation.refund > 0 ? method : 'No refund'); toast.success('Return recorded and stock updated'); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not record return'); } }} />;
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Return pieces · {displayReference(sale.invoice_no)}</DialogTitle></DialogHeader><div className="space-y-2">{lines.map(line => <label className="check-row" key={line.id}><input type="checkbox" checked={selected.includes(line.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, line.id] : previous.filter(id => id !== line.id))} /><span className="flex-1"><b>{line.name}</b><small>{line.tag_id}</small></span><b>{money(line.final_price)}</b></label>)}</div><div className="final-total"><span>RETURN VALUE</span><strong>{money(amount)}</strong></div><Field label="Return reason"><Input value={reason} maxLength={500} placeholder="e.g. Customer changed their mind" onChange={event => setReason(event.target.value)} /></Field><Field label="Refund method"><Select label="Refund method" value={allocation.refund === 0 ? 'No refund' : method} onChange={setMethod} options={allocation.refund === 0 ? ['No refund'] : ['Cash', 'Card', 'Bank Transfer']} /></Field><p className="text-sm text-muted-foreground">Estimated refund {money(allocation.refund)}{allocation.loanReduction > 0 && ` · ${money(allocation.loanReduction)} reduces the loan`}. The server rechecks every amount before saving.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!selected.length || reason.trim().length < 3} onClick={() => setReview(true)}><RotateCcw />Review return</Button></div></DialogContent></Dialog>;
}

function VoidBill({ sale, lines, onClose }: { sale: Sale; lines: Store['lines']; onClose: () => void }) {
  const { rawData, saleReversals, reverseSale, data } = usePos();
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('Cash');
  const amount = round(lines.reduce((sum, line) => sum + line.final_price, 0));
  const loan = rawData.loans.find(row => row.sale_id === sale.id);
  const allocation = reversalAllocation({ sale, loan, payments: rawData.payments, reversals: saleReversals, amount });
  return <CredentialConfirm title={`Void ${displayReference(sale.invoice_no)}?`} email={data.user?.email || ''} skipCredential={data.demo === true} onClose={onClose} detail={<div className="space-y-3"><p>This keeps the original invoice as <b>Voided</b>, returns every piece to stock, and cancels the linked loan.</p><div className="summary-lines"><p><span>Bill value</span><b>{money(amount)}</b></p><p><span>Refund to customer</span><b>{money(allocation.refund)}</b></p>{allocation.loanReduction > 0 && <p><span>Outstanding loan cancelled</span><b>{money(allocation.loanReduction)}</b></p>}</div><Field label="Void reason"><Input value={reason} maxLength={500} placeholder="e.g. Incorrect customer or payment entered" onChange={event => setReason(event.target.value)} /></Field><Field label="Refund method"><Select label="Void refund method" value={allocation.refund === 0 ? 'No refund' : method} onChange={setMethod} options={allocation.refund === 0 ? ['No refund'] : ['Cash', 'Card', 'Bank Transfer']} /></Field></div>} onConfirm={async () => { try { await reverseSale(sale.id, 'Void', lines.map(line => line.id), reason, allocation.refund > 0 ? method : 'No refund'); toast.success('Bill voided; stock and loan records updated'); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not void bill'); } }} />;
}

export function SalesHistory() {
  const { rawData, saleReversals, saleReversalItems, cheques, branch, can, deleteSale, data } = usePos();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [returning, setReturning] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const sales = useMemo(() => rawData.sales.filter(sale => sale.branch_id === branch).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [rawData.sales, branch]);
  const rows = sales.filter(sale => {
    const customer = rawData.customers.find(row => row.id === sale.customer_id);
    const currentStatus = saleLifecycleStatus(sale, rawData.lines, saleReversals, saleReversalItems);
    return (!from || (sale.date || '') >= from) && (!to || (sale.date || '') <= to) && (status === 'All statuses' || status === currentStatus) && `${displayReference(sale.invoice_no)} ${customer?.name || 'Walk-in'} ${customer?.phone || ''}`.toLowerCase().includes(search.toLowerCase());
  });
  const net = round(rows.reduce((sum, sale) => sum + sale.final_total - reversalTotals(saleReversals, sale.id).total, 0));
  const refunds = round(rows.reduce((sum, sale) => sum + reversalTotals(saleReversals, sale.id).refund, 0));
  const canManage = can('Manage settings');
  const remainingLines = (sale: Sale) => rawData.lines.filter(line => line.sale_id === sale.id && !saleReversalItems.some(item => item.sale_item_id === line.id));
  return <>
    <PageTitle title="Sales history" subtitle="Original bills, selected-piece returns, voids and safe deletion." />
    <div className="stats-grid"><Stat label="Bills" value={rows.length} /><Stat label="Net sales after returns" value={money(net)} /><Stat label="Refunds recorded" value={money(refunds)} /><Stat label="Voided bills" value={rows.filter(sale => saleLifecycleStatus(sale, rawData.lines, saleReversals, saleReversalItems) === 'Voided').length} /></div>
    <section className="dashboard-section"><div className="filter-row"><SearchBox value={search} set={setSearch} placeholder="Search invoice or customer" /><Select label="Sale status" value={status} onChange={setStatus} options={['All statuses', 'Completed', 'Part returned', 'Returned', 'Voided']} /><Field label="From"><Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={event => setTo(event.target.value)} /></Field></div><div className="table-scroll"><table><thead><tr><th>INVOICE / DATE</th><th>CUSTOMER</th><th>PAYMENT</th><th>ORIGINAL TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(sale => {
      const currentStatus = saleLifecycleStatus(sale, rawData.lines, saleReversals, saleReversalItems);
      const totals = reversalTotals(saleReversals, sale.id);
      const loan = rawData.loans.find(row => row.sale_id === sale.id);
      const block = saleDeletionBlock({ sale, loans: rawData.loans, cheques, reversals: saleReversals, items: rawData.items, lines: rawData.lines });
      return <tr key={sale.id}><td><b>{displayReference(sale.invoice_no)}</b><small>{sale.date}</small></td><td>{rawData.customers.find(row => row.id === sale.customer_id)?.name || 'Walk-in customer'}<small>{displayReference(loan?.loan_no) || 'No loan'}</small></td><td>{paymentTypeLabel(sale.payment_type)}<small>{sale.payment_method === 'Mixed' ? 'Split' : sale.payment_method}</small></td><td><b>{money(sale.final_total)}</b>{totals.total > 0 && <small>Net {money(round(sale.final_total - totals.total))} · Refund {money(totals.refund)}</small>}</td><td><span className={`badge ${currentStatus === 'Completed' ? 'success' : currentStatus === 'Voided' ? 'danger' : 'neutral'}`}>{currentStatus}</span></td><td><div className="flex flex-wrap gap-1"><Button size="icon" variant="ghost" title="View original invoice" onClick={() => setInvoice(sale.id)}><Eye /></Button>{canManage && currentStatus !== 'Voided' && remainingLines(sale).length > 0 && <Button size="icon" variant="ghost" title="Return selected pieces" onClick={() => setReturning(sale)}><RotateCcw /></Button>}{canManage && currentStatus === 'Completed' && <Button size="icon" variant="ghost" title="Void whole bill" onClick={() => setVoiding(sale)}><XCircle /></Button>}{canManage && <Button size="icon" variant="ghost" title={block || 'Delete standalone sale'} onClick={() => { if (block) toast.error(block); else setDeleting(sale); }}><Trash2 /></Button>}</div></td></tr>;
    })}</tbody></table></div>{!rows.length && <Empty title="No sales found" description="Completed, returned and voided bills will remain available here." />}</section>
    <section className="dashboard-section"><div className="dashboard-heading"><h2>Return & void history</h2><span>Append-only records</span></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>INVOICE</th><th>ACTION / REASON</th><th>VALUE</th><th>REFUND</th><th>LOAN REDUCTION</th></tr></thead><tbody>{saleReversals.filter(row => rows.some(sale => sale.id === row.sale_id)).map(row => <tr key={row.id}><td>{row.created_at.slice(0, 10)}</td><td>{displayReference(rawData.sales.find(sale => sale.id === row.sale_id)?.invoice_no)}</td><td><b>{row.kind}</b><small>{row.reason}</small></td><td>{money(row.total_amount)}</td><td>{money(row.refund_amount)}<small>{row.refund_method}</small></td><td>{money(row.loan_reduction)}</td></tr>)}</tbody></table></div>{!saleReversals.some(row => rows.some(sale => sale.id === row.sale_id)) && <Empty title="No returns or voids" description="Actions recorded here cannot overwrite the original invoice." />}</section>
    {invoice && <Invoice id={invoice} history onClose={() => setInvoice(null)} />}
    {returning && <ReturnPieces sale={returning} lines={remainingLines(returning)} onClose={() => setReturning(null)} />}
    {voiding && <VoidBill sale={voiding} lines={remainingLines(voiding)} onClose={() => setVoiding(null)} />}
    {deleting && <CredentialConfirm title={`Delete ${displayReference(deleting.invoice_no)}?`} email={data.user?.email || ''} skipCredential={data.demo === true} onClose={() => setDeleting(null)} detail={<p>This is allowed only because no loan, cheque, return, repayment or later stock history depends on this bill. Its pieces return to stock; a deletion audit remains.</p>} onConfirm={async () => { try { await deleteSale(deleting.id); toast.success('Standalone sale deleted and pieces returned to stock'); setDeleting(null); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete sale'); setDeleting(null); } }} />}
  </>;
}
