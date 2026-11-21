import {displayReference} from '@/lib/display-reference';
import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePos } from './data';
import { Field, Stat, Empty, Select, SearchBox } from './shared';
import { allocate, formatWeight, money, round, today } from '@/lib/pos-rules';
import { paymentTypeLabel } from '@/lib/payment-labels';
import { effectiveLoanPaid } from '@/lib/sale-lifecycle';
import { useOwnerCash } from './owner-cash';
import { capitalSummary, mainCashEffect, type OwnerCashKind } from '@/lib/owner-cash';
import { reportMatches, reportPeriod, type ReportRows } from '@/lib/report-export';
import { FilteredCsvButton, useReportExport } from './report-export';

type Part = { method: string; amount: number };
type Cell = ReactNode;
const salePayments = (sale: { payment_method: string; paid_now: number; payment_split: unknown }): Part[] => sale.paid_now <= 0 ? [] : sale.payment_method === 'Mixed' && Array.isArray(sale.payment_split) ? (sale.payment_split as Part[]) : [{ method: sale.payment_method === 'Mixed' ? 'Split' : sale.payment_method, amount: sale.paid_now }];
const add = (map: Map<string, number>, key: string, value: number) => map.set(key, round((map.get(key) || 0) + value));
const inRange = (date: string | null | undefined, from: string, to: string) => !!date && (!from || date >= from) && (!to || date <= to);

function Range({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  return <div className="form-grid report-filters"><Field label="From"><Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={event => setTo(event.target.value)} /></Field><Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>All time</Button></div>;
}

function Table({ head, rows, foot }: { head: string[]; rows: Cell[][]; foot?: Cell[] }) {
  return rows.length ? <div className="table-scroll"><table><thead><tr>{head.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>{foot && <tfoot><tr>{foot.map((cell, index) => <td key={index}><b>{cell}</b></td>)}</tr></tfoot>}</table></div> : <Empty title="Nothing matches these filters" description="Change the search or filters to see more." />;
}

function ExportBar({ filename, rows, count }: { filename: string; rows: ReportRows; count: number }) {
  return <div className="report-export-row"><span>{count} filtered detail {count === 1 ? 'row' : 'rows'}</span><FilteredCsvButton filename={filename} rows={rows} count={count} /></div>;
}

export function DailyCloseReport({ initialDate = today() }: { initialDate?: string | undefined }) {
  const { data, rawData, saleReversals, branch, pettyEntries } = usePos();
  const [date, setDate] = useState(initialDate || today());
  const [kind, setKind] = useState('All');
  const [method, setMethod] = useState('All');
  const [search, setSearch] = useState('');
  const owner = useOwnerCash(branch);
  const ownerDay = owner.rows.filter(row => row.date === date);
  const ownerSummary = capitalSummary(ownerDay);
  const ownerNet = round(ownerDay.reduce((total, row) => total + mainCashEffect(row.kind as OwnerCashKind, Number(row.amount)), 0));
  const sales = data.sales.filter(sale => sale.date === date);
  const cashSales = rawData.sales.filter(sale => sale.branch_id === branch && sale.date === date);
  const payments = rawData.payments.filter(payment => payment.branch_id === branch && payment.date === date);
  const refunds = saleReversals.filter(reversal => reversal.branch_id === branch && reversal.created_at.slice(0, 10) === date);
  const cash = pettyEntries.filter(entry => entry.branch_id === branch && entry.date === date);
  const byMethod = new Map<string, number>();
  cashSales.forEach(sale => salePayments(sale).forEach(part => add(byMethod, part.method, part.amount)));
  payments.forEach(payment => add(byMethod, payment.method === 'Mixed' ? 'Split' : payment.method, payment.amount));
  const billed = round(sales.reduce((total, sale) => total + sale.final_total, 0));
  const loans = round(sales.reduce((total, sale) => total + sale.loan_amount, 0));
  const repaid = round(payments.reduce((total, payment) => total + payment.amount, 0));
  const spent = round(cash.filter(entry => entry.kind === 'Expense').reduce((total, entry) => total + entry.amount, 0));
  const collected = round([...byMethod.values()].reduce((a, b) => a + b, 0));
  const refunded = round(refunds.reduce((total, reversal) => total + reversal.refund_amount, 0));
  const cashRefunded = round(refunds.filter(reversal => reversal.refund_method === 'Cash').reduce((total, reversal) => total + reversal.refund_amount, 0));

  type Activity = { type: string; reference: string; party: string; method: string; detail: string; moneyIn: number; moneyOut: number };
  const activity: Activity[] = [
    ...cashSales.map(sale => ({ type: 'Sale', reference: sale.invoice_no, party: data.customers.find(customer => customer.id === sale.customer_id)?.name || 'Walk-in', method: sale.payment_method, detail: `Billed ${money(sale.final_total)} · Credit ${money(sale.loan_amount)}`, moneyIn: sale.paid_now, moneyOut: 0 })),
    ...payments.map(payment => { const loan = data.loans.find(item => item.id === payment.loan_id); return { type: 'Loan repayment', reference: payment.receipt_no || loan?.loan_no || payment.id, party: data.customers.find(customer => customer.id === loan?.customer_id)?.name || 'Customer', method: payment.method, detail: loan?.loan_no || '', moneyIn: payment.amount, moneyOut: 0 }; }),
    ...refunds.map(reversal => { const sale = rawData.sales.find(item => item.id === reversal.sale_id); return { type: 'Refund / return', reference: sale?.invoice_no || reversal.sale_id, party: data.customers.find(customer => customer.id === sale?.customer_id)?.name || 'Customer', method: reversal.refund_method, detail: reversal.reason, moneyIn: 0, moneyOut: reversal.refund_amount }; }),
    ...cash.map(entry => ({ type: entry.kind === 'Expense' ? 'Expense' : 'Cash addition', reference: entry.reference || entry.id, party: entry.staff_name || entry.category, method: 'Cash', detail: `${entry.category} · ${entry.description}${entry.expense_month ? ` · ${entry.expense_month}` : ''}`, moneyIn: entry.kind === 'Expense' ? 0 : entry.amount, moneyOut: entry.kind === 'Expense' ? entry.amount : 0 })),
    ...(owner.allowed ? ownerDay.map(row => { const effect = mainCashEffect(row.kind as OwnerCashKind, Number(row.amount)); return { type: row.kind, reference: row.id, party: 'Owner / bank', method: row.kind.includes('Bank') ? 'Bank / main cash' : 'Main cash', detail: row.note || '', moneyIn: effect > 0 ? effect : 0, moneyOut: effect < 0 ? -effect : 0 }; }) : []),
  ];
  const filtered = activity.filter(row => (kind === 'All' || row.type === kind) && (method === 'All' || row.method === method) && reportMatches(search, row.type, row.reference, row.party, row.method, row.detail));
  const exportRows: ReportRows = [['Date', 'Type', 'Reference', 'Customer / payee', 'Method', 'Details', 'Money in', 'Money out'], ...filtered.map(row => [date, row.type, row.reference, row.party, row.method, row.detail, row.moneyIn, row.moneyOut])];
  useReportExport({ id: 'daily-close', title: 'Daily close', filename: `daily-close-${date}`, filters: `Shop day: ${date}; Type: ${kind}; Method: ${method}; Search: ${search || 'None'}`, rows: exportRows });

  return <>
    <ExportBar filename={`daily-close-${date}`} rows={exportRows} count={filtered.length} />
    <div className="report-filter-grid report-filters"><Field label="Shop day"><Input type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label="Activity type"><Select value={kind} onChange={setKind} options={['All', ...Array.from(new Set(activity.map(row => row.type))).sort()]} /></Field><Field label="Payment method"><Select value={method} onChange={setMethod} options={['All', ...Array.from(new Set(activity.map(row => row.method))).sort()]} /></Field></div>
    <SearchBox value={search} set={setSearch} placeholder="Search daily activity, invoice, customer or note" />
    <div className="stats-grid report-day-stats"><Stat label="Bills" value={sales.length} /><Stat label="Total billed" value={money(billed)} /><Stat label="Given as loans" value={money(loans)} /><Stat label="Loan repayments" value={money(repaid)} /><Stat label="Money received" value={money(collected)} /><Stat label="Refunds paid" value={money(refunded)} /><Stat label="Net money received" value={money(round(collected - refunded))} /><Stat label="Cash received" value={money(byMethod.get('Cash') || 0)} /><Stat label="Expenses paid" value={money(spent)} /><Stat label="Cash after expenses" value={money(round((byMethod.get('Cash') || 0) - spent - cashRefunded))} /></div>
    {owner.allowed && <><h3>Owner cash &amp; bank (not profit)</h3><div className="stats-grid"><Stat label="Owner cash in" value={money(ownerSummary.invested)} /><Stat label="Owner cash out" value={money(ownerSummary.withdrawn)} /><Stat label="Net to bank" value={money(ownerSummary.bank)} /><Stat label="Cash after owner &amp; bank moves" value={money(round((byMethod.get('Cash') || 0) - spent - cashRefunded + ownerNet))} /></div></>}
    <h3>Money received by method</h3><Table head={['METHOD', 'AMOUNT']} rows={[...byMethod].map(([name, amount]) => [name, money(amount)])} foot={['Total', money(collected)]} />
    <h3>Detailed daily activity</h3><Table head={['TYPE', 'REFERENCE', 'CUSTOMER / PAYEE', 'METHOD', 'DETAILS', 'MONEY IN', 'MONEY OUT']} rows={filtered.map(row => [row.type, row.reference, row.party, row.method, row.detail, money(row.moneyIn), money(row.moneyOut)])} />
    <h3>Bills</h3><Table head={['INVOICE', 'CUSTOMER', 'PAYMENT', 'TOTAL', 'PAID NOW']} rows={sales.map(sale => [sale.invoice_no, data.customers.find(customer => customer.id === sale.customer_id)?.name || 'Walk-in', paymentTypeLabel(sale.payment_type), money(sale.final_total), money(sale.paid_now)])} />
  </>;
}

export function StockReport() {
  const { data, metal, can } = usePos();
  const showCost = can('View costs and profit');
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('All');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('In Stock');
  const items = data.items.filter(item => (status === 'All' || item.status === status) && (metalFilter === 'All' || item.metal_id === metalFilter) && (category === 'All' || item.category === category) && reportMatches(search, item.system_tag, item.tag_id, item.name, item.supplier, item.sold_invoice));
  const groups = new Map<string, { n: number; w: number; c: number }>();
  items.forEach(item => { const key = `${item.category} · ${metal(item.metal_id)}`; const value = groups.get(key) || { n: 0, w: 0, c: 0 }; value.n++; value.w += item.weight; value.c += Number(item.purchase_price) || 0; groups.set(key, value); });
  const rows = [...groups].sort((a, b) => a[0].localeCompare(b[0]));
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  const totalCost = items.reduce((total, item) => total + (Number(item.purchase_price) || 0), 0);
  const exportRows: ReportRows = [['System tag', 'Internal tag', 'Item', 'Category', 'Metal', 'Weight (g)', 'Status', 'Supplier', 'Sold invoice', ...(showCost ? ['Purchase cost'] : [])], ...items.map(item => [item.system_tag, item.tag_id, item.name, item.category, metal(item.metal_id), item.weight, item.status, item.supplier || '', item.sold_invoice || '', ...(showCost ? [Number(item.purchase_price) || 0] : [])])];
  useReportExport({ id: 'stock', title: 'Stock', filename: 'detailed-stock', filters: `Snapshot; Status: ${status}; Metal: ${metalFilter === 'All' ? 'All' : metal(metalFilter)}; Category: ${category}; Search: ${search || 'None'}`, rows: exportRows });

  return <>
    <ExportBar filename="detailed-stock" rows={exportRows} count={items.length} />
    <div className="report-filter-grid report-filters"><Field label="Status"><Select value={status} onChange={setStatus} options={['In Stock', 'All', ...Array.from(new Set(data.items.map(item => item.status))).filter(value => value !== 'In Stock').sort()]} /></Field><Field label="Metal"><Select value={metalFilter} onChange={setMetalFilter} options={['All', ...data.metals.map(item => ({ value: item.id, label: item.name }))]} /></Field><Field label="Category"><Select value={category} onChange={setCategory} options={['All', ...Array.from(new Set(data.items.map(item => item.category))).sort()]} /></Field></div>
    <SearchBox value={search} set={setSearch} placeholder="Search system tag, internal tag, item, supplier or invoice" />
    <div className="stats-grid"><Stat label="Filtered pieces" value={items.length} /><Stat label="Total weight" value={formatWeight(round(totalWeight))} />{showCost && <Stat label="Stock at cost" value={money(round(totalCost))} />}</div>
    <h3>Summary by category and metal</h3><Table head={['CATEGORY · METAL', 'PIECES', 'WEIGHT', ...(showCost ? ['COST VALUE'] : [])]} rows={rows.map(([key, value]) => [key, value.n, formatWeight(round(value.w)), ...(showCost ? [money(round(value.c))] : [])])} foot={['Total', items.length, formatWeight(round(totalWeight)), ...(showCost ? [money(round(totalCost))] : [])]} />
    <h3>Item-level detail</h3><Table head={['SYSTEM TAG', 'INTERNAL TAG', 'ITEM', 'CATEGORY · METAL', 'WEIGHT', 'STATUS', 'SUPPLIER / INVOICE', ...(showCost ? ['PURCHASE COST'] : [])]} rows={items.map(item => [item.system_tag, item.tag_id, item.name, `${item.category} · ${metal(item.metal_id)}`, formatWeight(item.weight), item.status, item.status === 'In Stock' ? item.supplier || '—' : item.sold_invoice || '—', ...(showCost ? [money(Number(item.purchase_price) || 0)] : [])])} />
  </>;
}

export function LoanAgeReport() {
  const { data, loanRevisions, saleReversals } = usePos();
  const buckets = ['Not yet due', '1–30 days late', '31–60 days late', '61–90 days late', 'Over 90 days late'];
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState('All');
  const [frequency, setFrequency] = useState('All');
  const now = today();
  type AgeRow = { loanNo: string; invoice: string; customer: string; phone: string; frequency: string; paid: number; nextDue: string; values: number[]; outstanding: number; overdue: number };
  const allRows: AgeRow[] = [];
  data.loans.forEach(loan => {
    const revision = loanRevisions.find(row => row.loan_id === loan.id);
    const original = data.installments.filter(item => item.loan_id === loan.id);
    const planned = revision && Array.isArray(revision.schedule) ? revision.schedule.flatMap((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row['amount'] !== 'number' || typeof row['due_date'] !== 'string' || typeof row['installment_no'] !== 'number') return [];
      return [{ id: `${revision.id}-${index}`, installment_no: row['installment_no'], due_date: row['due_date'], amount: row['amount'] }];
    }) : original;
    const installments = allocate(planned, effectiveLoanPaid(loan, data.payments, saleReversals));
    const open = installments.filter(item => item.balance > 0);
    if (!open.length) return;
    const values = buckets.map(() => 0);
    open.forEach(item => { const days = Math.floor((Date.parse(now) - Date.parse(item.due_date)) / 86400000); const index = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4; values[index] = round((values[index] || 0) + item.balance); });
    const customer = data.customers.find(item => item.id === loan.customer_id);
    allRows.push({ loanNo: loan.loan_no, invoice: data.sales.find(sale => sale.id === loan.sale_id)?.invoice_no || '', customer: customer?.name || '', phone: customer?.phone || '', frequency: loan.frequency, paid: effectiveLoanPaid(loan, data.payments, saleReversals), nextDue: open[0]?.due_date || '', values, outstanding: round(values.reduce((a, b) => a + b, 0)), overdue: round(values.slice(1).reduce((a, b) => a + b, 0)) });
  });
  const rows = allRows.filter(row => (frequency === 'All' || row.frequency === frequency) && (bucket === 'All' || (bucket === 'Overdue' ? row.overdue > 0 : (row.values[buckets.indexOf(bucket)] || 0) > 0)) && reportMatches(search, row.loanNo, row.invoice, row.customer, row.phone));
  const sums = buckets.map((_, index) => round(rows.reduce((total, row) => total + (row.values[index] || 0), 0)));
  const exportRows: ReportRows = [['Loan', 'Invoice', 'Customer', 'Phone', 'Frequency', 'Effective paid', 'Next due', ...buckets, 'Overdue', 'Outstanding'], ...rows.map(row => [row.loanNo, row.invoice, row.customer, row.phone, row.frequency, row.paid, row.nextDue, ...row.values, row.overdue, row.outstanding])];
  useReportExport({ id: 'loan-age', title: 'Loan ageing', filename: 'loan-ageing', filters: `Snapshot as at ${now}; Bucket: ${bucket}; Frequency: ${frequency}; Search: ${search || 'None'}`, rows: exportRows });

  return <>
    <ExportBar filename="loan-ageing" rows={exportRows} count={rows.length} />
    <div className="report-filter-grid report-filters"><Field label="Ageing bucket"><Select value={bucket} onChange={setBucket} options={['All', 'Overdue', ...buckets]} /></Field><Field label="Repayment frequency"><Select value={frequency} onChange={setFrequency} options={['All', ...Array.from(new Set(data.loans.map(loan => loan.frequency))).sort()]} /></Field></div>
    <SearchBox value={search} set={setSearch} placeholder="Search loan, invoice, customer or phone" />
    <div className="stats-grid">{buckets.map((label, index) => <Stat key={label} label={label} value={money(sums[index] || 0)} />)}</div>
    <Table head={['LOAN / INVOICE', 'CUSTOMER / PHONE', 'FREQUENCY', 'PAID', 'NEXT DUE', ...buckets.map(label => label.toUpperCase()), 'OUTSTANDING']} rows={rows.map(row => [`${row.loanNo} · ${row.invoice}`, `${row.customer} · ${row.phone}`, row.frequency, money(row.paid), row.nextDue, ...row.values.map(value => value ? money(value) : '—'), money(row.outstanding)])} foot={['Total', '', '', '', '', ...sums.map(value => money(value)), money(round(sums.reduce((a, b) => a + b, 0)))]} />
  </>;
}

export function ExpenseReport({ initialFrom = today(), initialTo = today() }: { initialFrom?: string | undefined; initialTo?: string | undefined }) {
  const { branch, pettyEntries } = usePos();
  const [from, setFrom] = useState(initialFrom || '');
  const [to, setTo] = useState(initialTo || '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [kind, setKind] = useState('All');
  const [month, setMonth] = useState('');
  const list = pettyEntries.filter(entry => entry.branch_id === branch && inRange(entry.date, from, to) && (category === 'All' || entry.category === category) && (kind === 'All' || entry.kind === kind) && (!month || entry.expense_month === month) && reportMatches(search, entry.category, entry.staff_name, entry.description, entry.reference, entry.expense_month));
  const groups = new Map<string, number>();
  list.filter(entry => entry.kind === 'Expense').forEach(entry => add(groups, entry.category || 'Other', entry.amount));
  const spent = round(list.filter(entry => entry.kind === 'Expense').reduce((total, entry) => total + entry.amount, 0));
  const funded = round(list.filter(entry => entry.kind !== 'Expense').reduce((total, entry) => total + entry.amount, 0));
  const exportRows: ReportRows = [['Date', 'Kind', 'Category', 'Payee', 'Payee type', 'Description', 'Reference', 'Expense month', 'Entered by', 'Amount'], ...list.map(entry => [entry.date, entry.kind, entry.category, entry.staff_name || '', entry.staff_type || '', entry.description, entry.reference, entry.expense_month || '', entry.created_by, entry.amount])];
  useReportExport({ id: 'expenses', title: 'Expenses', filename: 'expenses-detailed', filters: `${reportPeriod(from, to)}; Category: ${category}; Kind: ${kind}; Expense month: ${month || 'All'}; Search: ${search || 'None'}`, rows: exportRows });

  return <>
    <ExportBar filename="expenses-detailed" rows={exportRows} count={list.length} />
    <Range {...{ from, to, setFrom, setTo }} />
    <div className="report-filter-grid report-filters"><Field label="Category"><Select value={category} onChange={setCategory} options={['All', ...Array.from(new Set(pettyEntries.filter(entry => entry.branch_id === branch).map(entry => entry.category))).sort()]} /></Field><Field label="Entry kind"><Select value={kind} onChange={setKind} options={['All', ...Array.from(new Set(pettyEntries.map(entry => entry.kind))).sort()]} /></Field><Field label="Expense month"><Input type="month" value={month} onChange={event => setMonth(event.target.value)} /></Field></div>
    <SearchBox value={search} set={setSearch} placeholder="Search category, payee, description or reference" />
    <div className="stats-grid"><Stat label="Filtered expenses" value={money(spent)} /><Stat label="Cash added" value={money(funded)} /><Stat label="Entries" value={list.length} /></div>
    <h3>Summary by category</h3><Table head={['CATEGORY', 'AMOUNT']} rows={[...groups].sort((a, b) => b[1] - a[1]).map(([key, value]) => [key, money(value)])} foot={['Total', money(spent)]} />
    <h3>Expense transaction detail</h3><Table head={['DATE', 'KIND', 'CATEGORY', 'PAYEE', 'DESCRIPTION / REFERENCE', 'MONTH', 'AMOUNT']} rows={list.map(entry => [entry.date, entry.kind, entry.category, entry.staff_name ? `${entry.staff_name} · ${entry.staff_type || ''}` : '—', `${entry.description}${entry.reference ? ` · ${entry.reference}` : ''}`, entry.expense_month || '—', money(entry.amount)])} />
  </>;
}

export function StaffSalesReport({ initialFrom = today(), initialTo = today() }: { initialFrom?: string | undefined; initialTo?: string | undefined }) {
  const { data } = usePos();
  const [from, setFrom] = useState(initialFrom || '');
  const [to, setTo] = useState(initialTo || '');
  const [staff, setStaff] = useState('All');
  const [payment, setPayment] = useState('All');
  const [search, setSearch] = useState('');
  const sales = data.sales.filter(sale => inRange(sale.date, from, to) && (staff === 'All' || sale.created_by === staff) && (payment === 'All' || sale.payment_type === payment) && reportMatches(search, sale.invoice_no, data.customers.find(customer => customer.id === sale.customer_id)?.name, data.staff.find(person => person.id === sale.created_by)?.display_name));
  const groups = new Map<string, { n: number; t: number; w: number; received: number; credit: number }>();
  sales.forEach(sale => { const value = groups.get(sale.created_by) || { n: 0, t: 0, w: 0, received: 0, credit: 0 }; value.n++; value.t = round(value.t + sale.final_total); value.received = round(value.received + sale.paid_now); value.credit = round(value.credit + sale.loan_amount); value.w += data.lines.filter(line => line.sale_id === sale.id).reduce((total, line) => total + line.weight, 0); groups.set(sale.created_by, value); });
  const exportRows: ReportRows = [['Staff', 'Invoice', 'Date', 'Customer', 'Payment type', 'Payment method', 'Pieces', 'Weight (g)', 'Sale total', 'Received', 'Credit'], ...sales.map(sale => { const lines = data.lines.filter(line => line.sale_id === sale.id); return [data.staff.find(person => person.id === sale.created_by)?.display_name || 'Staff', sale.invoice_no, sale.date, data.customers.find(customer => customer.id === sale.customer_id)?.name || 'Walk-in', paymentTypeLabel(sale.payment_type), sale.payment_method, lines.length, lines.reduce((total, line) => total + line.weight, 0), sale.final_total, sale.paid_now, sale.loan_amount]; })];
  useReportExport({ id: 'staff', title: 'Staff sales', filename: 'staff-sales-detailed', filters: `${reportPeriod(from, to)}; Staff: ${staff === 'All' ? 'All' : data.staff.find(person => person.id === staff)?.display_name || staff}; Payment: ${payment}; Search: ${search || 'None'}`, rows: exportRows });

  return <>
    <ExportBar filename="staff-sales-detailed" rows={exportRows} count={sales.length} />
    <Range {...{ from, to, setFrom, setTo }} />
    <div className="report-filter-grid report-filters"><Field label="Staff"><Select value={staff} onChange={setStaff} options={['All', ...data.staff.map(person => ({ value: person.id, label: person.display_name }))]} /></Field><Field label="Payment type"><Select value={payment} onChange={setPayment} options={['All', ...Array.from(new Set(data.sales.map(sale => sale.payment_type))).map(value => ({ value, label: paymentTypeLabel(value) }))]} /></Field></div>
    <SearchBox value={search} set={setSearch} placeholder="Search invoice, customer or staff" />
    <h3>Staff summary</h3><Table head={['STAFF', 'BILLS', 'WEIGHT SOLD', 'SALES', 'RECEIVED', 'CREDIT']} rows={[...groups].sort((a, b) => b[1].t - a[1].t).map(([id, value]) => [data.staff.find(person => person.id === id)?.display_name || 'Staff', value.n, formatWeight(round(value.w)), money(value.t), money(value.received), money(value.credit)])} />
    <h3>Invoice-level detail</h3><Table head={['STAFF', 'INVOICE / DATE', 'CUSTOMER', 'PAYMENT', 'PIECES / WEIGHT', 'SALES', 'RECEIVED', 'CREDIT']} rows={sales.map(sale => { const lines = data.lines.filter(line => line.sale_id === sale.id); return [data.staff.find(person => person.id === sale.created_by)?.display_name || 'Staff', `${displayReference(sale.invoice_no)} · ${sale.date}`, data.customers.find(customer => customer.id === sale.customer_id)?.name || 'Walk-in', paymentTypeLabel(sale.payment_type), `${lines.length} · ${formatWeight(lines.reduce((total, line) => total + line.weight, 0))}`, money(sale.final_total), money(sale.paid_now), money(sale.loan_amount)]; })} />
  </>;
}
