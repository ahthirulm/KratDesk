import {displayReference} from '@/lib/display-reference';
import { paymentTypeLabel } from '@/lib/payment-labels';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useCurrency } from './currency-data';
import { profitSummary } from '@/lib/profit-summary';
import * as XLSX from 'xlsx';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePos } from './data';
import { Field, PageTitle, Panel, Select, Stat, Empty, SearchBox } from './shared';
import { Invoice } from './billing';
import { formatWeight, money, today } from '@/lib/pos-rules';
import { inReportPeriod } from '@/lib/report-period';
import { sanitizeSpreadsheetRecords } from '@/lib/spreadsheet';
import { reportMatches, reportPeriod, type ReportRows } from '@/lib/report-export';
import { FilteredCsvButton, useReportExport } from './report-export';

export function Reports({ embedded = false, initialFrom = today(), initialTo = today() }: { embedded?: boolean; initialFrom?: string | undefined; initialTo?: string | undefined } = {}) {
  const { data, branch, can } = usePos();
  const currency = useCurrency();
  const showCurrency = can('View currency reports');
  const showCost = can('View costs and profit');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState('All');
  const [staff, setStaff] = useState('All');
  const [metal, setMetal] = useState('All');
  const [category, setCategory] = useState('All');
  const [invoice, setInvoice] = useState<string | null>(null);

  const periodSales = data.sales.filter(sale => inReportPeriod(sale.date || '', from, to));
  const sales = periodSales.filter(sale => {
    const customer = data.customers.find(item => item.id === sale.customer_id);
    const saleLines = data.lines.filter(line => line.sale_id === sale.id);
    const loan = data.loans.find(item => item.sale_id === sale.id);
    return (payment === 'All' || sale.payment_type === payment)
      && (staff === 'All' || sale.created_by === staff)
      && (metal === 'All' || saleLines.some(line => data.items.find(item => item.id === line.item_id)?.metal_id === metal))
      && (category === 'All' || saleLines.some(line => data.items.find(item => item.id === line.item_id)?.category === category))
      && reportMatches(search, sale.invoice_no, customer?.name, customer?.phone, saleLines.map(line => `${line.tag_id} ${data.items.find(item => item.id === line.item_id)?.system_tag || ''} ${line.name}`).join(' '), loan?.loan_no, data.staff.find(item => item.id === sale.created_by)?.display_name);
  });
  const lines = data.lines.filter(line => sales.some(sale => sale.id === line.sale_id));
  const costs = data.costs.filter(cost => lines.some(line => line.id === cost.sale_item_id));
  const periodLines = data.lines.filter(line => periodSales.some(sale => sale.id === line.sale_id));
  const periodCosts = data.costs.filter(cost => periodLines.some(line => line.id === cost.sale_item_id));
  const sum = (key: 'final_total' | 'calculated_total' | 'paid_now' | 'loan_amount') => sales.reduce((total, sale) => total + sale[key], 0);
  const cost = costs.reduce((total, row) => total + row.purchase_cost, 0);
  const payments = (data.grossPayments || data.payments).filter(paymentRow => paymentRow.branch_id === branch && inReportPeriod(paymentRow.date || '', from, to)).reduce((total, paymentRow) => total + paymentRow.amount, 0);
  const refunds = (data.reversals || []).filter(reversal => reversal.branch_id === branch && inReportPeriod(reversal.created_at.slice(0, 10), from, to)).reduce((total, reversal) => total + reversal.refund_amount, 0);
  const grossCashSales = (data.grossSales || data.sales).filter(sale => sale.branch_id === branch && inReportPeriod(sale.date || '', from, to)).reduce((total, sale) => total + sale.paid_now, 0);
  const periodTotal = periodSales.reduce((total, sale) => total + sale.final_total, 0);
  const periodCost = periodCosts.reduce((total, row) => total + row.purchase_cost, 0);
  const profit = profitSummary(periodTotal - periodCost, currency.entries, branch, from, to);
  const fxValue = currency.error ? 'Unavailable' : currency.loading ? 'Loading…' : money(profit.currency);
  const totalValue = currency.error ? 'Unavailable' : currency.loading ? 'Loading…' : money(profit.total);

  const records = sales.map(sale => {
    const saleLines = lines.filter(line => line.sale_id === sale.id);
    const saleCost = costs.filter(costRow => saleLines.some(line => line.id === costRow.sale_item_id)).reduce((total, costRow) => total + costRow.purchase_cost, 0);
    const customer = data.customers.find(item => item.id === sale.customer_id);
    const split = Array.isArray(sale.payment_split) ? sale.payment_split.map(part => {
      if (!part || typeof part !== 'object' || Array.isArray(part)) return '';
      const row = part as Record<string, unknown>;
      return `${String(row['method'] || '')}: ${money(Number(row['amount'] || 0))}`;
    }).filter(Boolean).join(' + ') : '';
    return {
      Invoice: displayReference(sale.invoice_no),
      Date: sale.date,
      'Entered at': sale.created_at,
      Customer: customer?.name || 'Walk-in',
      'Customer phone': customer?.phone || '',
      Staff: data.staff.find(item => item.id === sale.created_by)?.display_name || 'Staff',
      Tags: saleLines.map(line => `${data.items.find(item => item.id === line.item_id)?.system_tag || 'No system tag'} / ${line.tag_id}`).join(', '),
      'Piece count': saleLines.length,
      Pieces: saleLines.map(line => `${line.tag_id} ${line.name} · ${data.items.find(item => item.id === line.item_id)?.category || 'Uncategorised'} · ${formatWeight(line.weight)} × ${money(line.unit_price ?? line.rate_used)}/${line.pricing_unit === 'Pound (8g)' ? 'pound (8g)' : 'g'} = ${money(line.final_price)}`).join(' | '),
      Weight: saleLines.reduce((total, line) => total + line.weight, 0),
      Calculated: sale.calculated_total,
      Sold: sale.final_total,
      'Paid now': sale.paid_now,
      Credit: sale.loan_amount,
      Cost: saleCost,
      Profit: sale.final_total - saleCost,
      'Payment type': paymentTypeLabel(sale.payment_type),
      'Payment method': sale.payment_method,
      'Split detail': split,
      Loan: displayReference(data.loans.find(loan => loan.sale_id === sale.id)?.loan_no),
    };
  });
  const exportRecords = records.map(record => showCost ? record : (({ Cost: _cost, Profit: _profit, ...safe }) => safe)(record));
  const headers = Object.keys(exportRecords[0] || { Invoice: '', Date: '', Customer: '', 'Customer phone': '', Staff: '', Tags: '', 'Piece count': 0, Pieces: '', Weight: 0, Calculated: 0, Sold: 0, 'Paid now': 0, Credit: 0, ...(showCost ? { Cost: 0, Profit: 0 } : {}), 'Payment type': '', 'Payment method': '', 'Split detail': '', Loan: '' });
  const exportRows: ReportRows = [headers, ...exportRecords.map(record => headers.map(header => record[header as keyof typeof record] as string | number))];
  const filterDescription = `${reportPeriod(from, to)}; Payment: ${payment}; Staff: ${staff === 'All' ? 'All' : data.staff.find(item => item.id === staff)?.display_name || staff}; Metal: ${metal === 'All' ? 'All' : data.metals.find(item => item.id === metal)?.name || metal}; Category: ${category}; Search: ${search || 'None'}`;
  useReportExport({ id: 'jewellery', title: 'Jewellery sales', filename: `jewellery-sales-${reportPeriod(from, to)}`, filters: filterDescription, rows: exportRows, loading: currency.loading, error: currency.error || undefined });

  function quick(type: string) {
    if (type === 'all') { setFrom(''); setTo(''); return; }
    const date = new Date(today() + 'T12:00:00Z');
    if (type === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    if (type === 'month') date.setUTCDate(1);
    setFrom(date.toISOString().slice(0, 10)); setTo(today());
  }
  function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(sanitizeSpreadsheetRecords(exportRecords));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
    XLSX.writeFile(workbook, `sales-${from || to ? `${from || 'start'}-${to || 'end'}` : 'all-time'}-filtered.xlsx`);
  }

  return <>
    <PageTitle embedded={embedded} title="Jewellery sales & profit" subtitle="Invoice-level detail; every export matches the filters below." actions={<div className="flex flex-wrap gap-2"><FilteredCsvButton filename={`jewellery-sales-${reportPeriod(from, to)}`} rows={exportRows} count={records.length} /><Button variant="outline" onClick={exportExcel} disabled={!records.length}><Download />Filtered Excel</Button></div>} />
    <div className="report-filters report-filter-stack">
      <div className="flex flex-wrap gap-2">{['Today', 'This Week', 'This Month', 'All time'].map((label, index) => <Button key={label} variant="outline" onClick={() => quick(['today', 'week', 'month', 'all'][index] || 'today')}>{label}</Button>)}</div>
      <div className="report-filter-grid">
        <Field label="From"><Input aria-label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field>
        <Field label="To"><Input aria-label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} /></Field>
        <Field label="Payment type"><Select label="Sales payment filter" value={payment} onChange={setPayment} options={['All', ...Array.from(new Set(data.sales.map(sale => sale.payment_type))).map(value => ({ value, label: paymentTypeLabel(value) }))]} /></Field>
        <Field label="Staff"><Select label="Sales staff filter" value={staff} onChange={setStaff} options={['All', ...data.staff.map(item => ({ value: item.id, label: item.display_name }))]} /></Field>
        <Field label="Metal"><Select label="Sales metal filter" value={metal} onChange={setMetal} options={['All', ...data.metals.map(item => ({ value: item.id, label: item.name }))]} /></Field>
        <Field label="Category"><Select label="Sales category filter" value={category} onChange={setCategory} options={['All', ...Array.from(new Set(data.items.map(item => item.category))).sort()]} /></Field>
      </div>
      <SearchBox value={search} set={setSearch} placeholder="Search invoice, customer, phone, tag or loan" />
    </div>
    <section className="dashboard-section profit-summary-section"><div className="dashboard-heading"><div><h2>Profit breakdown</h2><span>Date-period totals</span></div>{showCurrency && <Button asChild variant="outline"><Link to="/reports" search={{ report: 'currency' }}>Currency report</Link></Button>}</div><div className="stats-grid"><Stat label="Combined profit" value={showCost && showCurrency ? totalValue : 'Restricted'} /><Stat label="Jewellery profit" value={showCost ? money(profit.jewellery) : 'Restricted'} /><Stat label="Currency exchange profit" value={showCurrency ? fxValue : 'Restricted'} /></div></section>
    <div className="stats-grid report-stats"><Stat label="Filtered bills" value={sales.length} /><Stat label="Weight sold" value={formatWeight(lines.reduce((total, line) => total + line.weight, 0))} /><Stat label="Total sales" value={money(sum('final_total'))} />{showCost && <><Stat label="Total cost" value={money(cost)} /><Stat label="Jewellery profit" value={money(sum('final_total') - cost)} /></>}<Stat label="Received at sale" value={money(sum('paid_now'))} /><Stat label="Given on loan" value={money(sum('loan_amount'))} /><Stat label="Loan repayments (period)" value={money(payments)} /><Stat label="Refunds paid (period)" value={money(refunds)} /><Stat label="Net cash in (period)" value={money(grossCashSales + payments - refunds)} /></div>
    <Panel title={`Detailed sales history · ${records.length} bills`}><div className="table-scroll"><table><thead><tr><th>INVOICE / DATE</th><th>CUSTOMER / CONTACT</th><th>STAFF</th><th>PIECES / TAGS</th><th>WEIGHT</th><th>CALCULATED</th><th>SOLD FOR</th><th>RECEIVED</th><th>CREDIT</th>{showCost && <><th>COST</th><th>PROFIT</th></>}<th>PAYMENT</th><th /></tr></thead><tbody>{records.map((record, index) => <tr key={record.Invoice}><td><b>{record.Invoice}</b><small>{record.Date}</small></td><td><b>{record.Customer}</b><small>{record['Customer phone'] || 'No phone'}</small></td><td>{record.Staff}</td><td><b>{record['Piece count']} pieces</b><small>{record.Tags}</small>{record.Pieces.split(' | ').map((piece, pieceIndex) => <small key={pieceIndex}>{piece}</small>)}</td><td>{formatWeight(record.Weight)}</td><td>{money(record.Calculated)}</td><td>{money(record.Sold)}</td><td>{money(record['Paid now'])}</td><td>{money(record.Credit)}</td>{showCost && <><td>{money(record.Cost)}</td><td className={record.Profit >= 0 ? 'positive' : 'negative'}>{money(record.Profit)}</td></>}<td>{record['Payment type']}<small>{record['Payment method']}{record['Split detail'] ? ` · ${record['Split detail']}` : ''}</small><small>{record.Loan}</small></td><td><Button variant="ghost" size="icon" title="Reprint invoice" onClick={() => setInvoice(sales[index]?.id || null)}><Printer /></Button></td></tr>)}</tbody></table></div>{!sales.length && <Empty title="No sales match these filters" description="Change the dates, search or filter choices to see more." />}</Panel>
    {invoice && <Invoice id={invoice} onClose={() => setInvoice(null)} />}
  </>;
}
