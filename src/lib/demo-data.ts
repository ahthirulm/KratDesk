import type { Store } from '@/components/pos/data';
import { SHOP_BRANCHES } from './branches';
import { round, schedule, today } from './pos-rules';

// Fictional presentation records only. Never persisted to the connected shop.
export function createDemoStore(branch = 'B1', day = today()): Store {
  const offset = (days: number) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const id = (kind: string, n: number) => `demo-${branch}-${kind}-${n}`;
  const metals = ['22K Gold', '24K Gold', '18K Gold', 'Silver', '21K Gold'].map((name, n) => ({ id: `demo-metal-${n}`, name }));
  const prices = [28500, 31000, 23500, 350, 26500];
  const customers = ['Nadeesha Perera', 'Fathima Rizna', 'Kavindu Silva', 'Ayesha Rahman', 'Tharindu Fernando', 'Shalini Joseph'].map((name, n) => ({ id: `demo-customer-${n}`, name: `Sample · ${name}`, phone: `07X XXX ${String(n + 1).padStart(4, '0')}` }));
  const staff = [
    { id: 'demo-owner', display_name: 'Sample Owner' },
    { id: 'demo-cashier-B1', display_name: 'Sample · City Jewels Cashier' },
    { id: 'demo-cashier-B2', display_name: 'Sample · Alishara Cashier' },
  ];
  const names = ['Traditional gold necklace', 'Classic wedding band', 'Lotus pendant', 'Gold bangle', 'Stud earrings', 'Curb chain', 'Silver anklet', 'Diamond-cut bracelet', 'Coin pendant', 'Twisted gold ring', 'Silver chain', 'Gold drop earrings', 'Wedding necklace', 'Gold signet ring', 'Silver bracelet', 'Gold charm pendant', 'Gold hoop earrings', 'Gold bangle pair'];
  const weights = [16.250, 4.125, 3.750, 8.500, 2.350, 12.800, 18.600, 6.450, 8, 3.125, 22.750, 4.650, 24.500, 5.250, 15.800, 3.600, 4.200, 16];
  const items: Store['items'] = names.map((name, n) => {
    const metalIndex = [6, 10, 14].includes(n) ? 3 : n === 8 ? 1 : [4, 11, 16].includes(n) ? 2 : 0;
    const weight = Number(((weights[n] ?? 4) + (branch === 'B2' ? 0.125 : 0)).toFixed(3));
    return {
      branch_id:branch, id: id('item', n), tag_id: `DEMO-${branch}-${String(n + 1).padStart(5, '0')}`, category: name.toLowerCase().includes('ring')||name.includes('band')?'Ring':name.includes('earring')?'Earring':name.includes('bangle')?'Bangles':name.includes('necklace')?'Necklace':name.includes('chain')?'Chain':name.includes('pendant')?'Pendant':name.includes('bracelet')?'Bracelet':name.includes('anklet')?'Anklet':'Other', system_tag: `KD${String((branch==='B2'?18:0)+n+1).padStart(6,'0')}`, name,
      metal_id: `demo-metal-${metalIndex}`, weight, supplier: n % 2 ? 'Sample · Goldcraft Supplier' : 'Sample · Lanka Jewellery Wholesale',
      photo_url: null, status: n >= 12 ? 'Sold' : 'In Stock', sold_invoice: n >= 12 ? `DEMO-${branch}-INV-${String(n - 11).padStart(5, '0')}` : null,
      created_at: `${offset(-30 + n)}T04:30:00Z`, purchase_price: round(weight * (prices[metalIndex] ?? 0) * 0.86),
    };
  });
  const sales: Store['sales'] = [];
  const lines: Store['lines'] = [];
  const costs: Store['costs'] = [];
  const loans: Store['loans'] = [];
  const installments: Store['installments'] = [];
  const payments: Store['payments'] = [];
  items.slice(12).forEach((item, n) => {
    const saleId = id('sale', n);
    const date = offset([0, 0, -2, -35, -65, -100][n] ?? 0);
    const rate = prices[Number(item.metal_id.split('-').at(-1))] ?? 0;
    const calculated = round(item.weight * rate);
    const total = round(calculated * 0.97);
    const paymentType = n === 0 || n === 2 ? 'Full Payment' : n === 4 ? 'Full Loan' : 'Cash + Loan';
    const paid = paymentType === 'Full Payment' ? total : paymentType === 'Full Loan' ? 0 : round(total * 0.4);
    const loanAmount = round(total - paid);
    const customer = customers[n];
    if (!customer) return;
    sales.push({ branch_id:branch, id: saleId, invoice_no: item.sold_invoice ?? '', date, customer_id: customer.id,
      payment_type: paymentType, payment_split: null, payment_method: n % 2 ? 'Cash' : 'Card', calculated_total: calculated,
      final_total: total, paid_now: paid, loan_amount: loanAmount, created_by: `demo-cashier-${branch}`, created_at: `${date}T05:30:00Z` });
    lines.push({ id: id('line', n), sale_id: saleId, item_id: item.id, tag_id: item.tag_id, name: item.name,
      metal: metals.find(m => m.id === item.metal_id)?.name ?? '', weight: item.weight,
      pricing_unit:null,unit_price:null,rate_used: rate, calculated_price: calculated, final_price: total });
    costs.push({ sale_item_id: id('line', n), purchase_cost: item.purchase_price ?? 0 });
    if (!loanAmount) return;
    const loanId = id('loan', n);
    loans.push({ branch_id:branch, id: loanId, loan_no: `DEMO-${branch}-LN-${String(n + 1).padStart(5, '0')}`, sale_id: saleId,
      customer_id: customer.id, amount: loanAmount, frequency: 'Monthly', status: n === 5 ? 'Closed' : 'Active', created_at: `${date}T05:30:00Z` });
    const firstDue = n === 1 ? offset(30) : n === 3 ? offset(-5) : n === 4 ? offset(-35) : offset(-70);
    const plan = schedule(loanAmount, n === 5 ? 3 : 6, 'Monthly', firstDue);
    installments.push(...plan.map((entry, j) => ({ ...entry, id: id(`installment-${n}`, j), loan_id: loanId })));
    const paidBack = n === 5 ? loanAmount : n === 4 ? (plan[0]?.amount ?? 0) : n === 3 ? round((plan[0]?.amount ?? 0) / 2) : 0;
    if (paidBack) payments.push({ branch_id:branch, id: id('payment', n), loan_id: loanId, receipt_no: `DEMO-${branch}-RC-${String(n + 1).padStart(5, '0')}`,
      date: n === 3 ? day : offset(-3), amount: paidBack, method: n === 4 ? 'Bank Transfer' : 'Cash', received_by: `demo-cashier-${branch}` });
  });
  return {
    demo: true, user: null, admin: false, owner: false, name: 'Sample preview', metals,
    rates: [0, -1, -2, -7].flatMap(days => metals.map((metal, n) => ({ date: offset(days), metal_id: metal.id, rate_per_gram: round((prices[n] ?? 0) * (1 + days * 0.001)) }))),
    items, customers, sales, lines, costs, loans, installments, payments, staff:staff.map(person=>({...person,username:null,mfa_enabled:false,two_factor_required:false,phone:'',avatar_path:null})),
    roles: staff.map((person, n) => ({ user_id: person.id, role: n === 0 ? 'admin' : 'cashier' })),
    settings: { shop_name: SHOP_BRANCHES.find(b => b.id === branch)?.name ?? SHOP_BRANCHES[0].name,
      address: 'Sample address · Sri Lanka', phone: '07X XXX XXXX', currency: 'LKR', country: 'Sri Lanka',pricing_unit:'Pound (8g)',inactivity_minutes:60 },
  };
}