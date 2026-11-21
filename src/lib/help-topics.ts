// A plain-language guide to everything the shop can do. The Help screen answers
// "how do I..." questions from this list, so answers always match the real screens.
export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  route: string;
  routeLabel: string;
  keywords: string[];
  section: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'reset',
    title: 'Reset shop data (factory reset)',
    summary: 'Clear chosen branches and record types, or the whole shop. Your owner login, shop details, branches and metal types always stay.',
    steps: [
      'Open Administration in the sidebar.',
      'In the Factory reset card, press Open factory reset.',
      'Tick the branches to reset, then tick the record types to clear (stock, bills, loans, jobs, money, reminders, customers, directories, rates, staff, audit).',
      'Shop-wide items — customers, suppliers and categories, rates and staff — need every branch ticked.',
      'Type FACTORY RESET, enter your own password, then press Reset the shop.',
    ],
    route: '/management',
    routeLabel: 'Open Administration',
    keywords: ['reset', 'factory reset', 'wipe', 'clear', 'delete everything', 'start over', 'erase', 'empty shop', 'remove all data'],
    section: 'Administration',
  },
  {
    id: 'backup',
    title: 'Take a backup',
    summary: 'Save shop records to one file, for chosen branches or the whole shop, optionally sealed with a password.',
    steps: [
      'Open Administration.',
      'In the Backup card, tick the branches to include — or all of them for the entire shop.',
      'Tick Seal with a password if the file may be stored somewhere unsafe, and type the password twice.',
      'Press Download backup. Shop-wide records are always included so the file can be restored later.',
    ],
    route: '/management',
    routeLabel: 'Open Administration',
    keywords: ['backup', 'back up', 'save file', 'copy of data', 'export everything', 'sealed', 'encrypt', 'password file'],
    section: 'Administration',
  },
  {
    id: 'restore',
    title: 'Restore from a backup',
    summary: 'Put a backup file back. Only the shop owner can do this, and it replaces the chosen branches\u2019 records.',
    steps: [
      'Open Administration and scroll to the Restore card.',
      'If the file is sealed (.enc), type its password in Sealed backup password first.',
      'Press Choose backup file and pick the file.',
      'Tick the branches to restore, type your own password, then press Restore.',
      'Logins, branches, shop settings and metal types are never overwritten.',
    ],
    route: '/management',
    routeLabel: 'Open Administration',
    keywords: ['restore', 'recover', 'open backup', 'import backup', 'undo data loss', 'bring back'],
    section: 'Administration',
  },
  {
    id: 'billing',
    title: 'Make a bill',
    summary: 'Pick pieces, check weight-based prices, take payment and print.',
    steps: [
      'Open Billing from the sidebar or the Bill button at the bottom on a phone.',
      'Search or scan the piece by its shop tag, system tag or barcode and add each one.',
      'Check the weight and price per gram on each line — the bill shows weight and price only.',
      'Set the sale date if you are recording an earlier sale (past dates allowed, not before 2000).',
      'Choose the payment type, take payment, then print or save the bill.',
    ],
    route: '/billing',
    routeLabel: 'Open Billing',
    keywords: ['bill', 'invoice', 'sell', 'sale', 'checkout', 'new sale', 'price', 'weight', 'gram', 'pound'],
    section: 'Counter',
  },
  {
    id: 'split',
    title: 'Split a payment across two methods',
    summary: 'Pay one bill with two methods, for example part cash and part card, or part cash and part cheque.',
    steps: [
      'In Billing, choose Split as the payment type.',
      'Pick the two methods and type the amount for each.',
      'The two amounts must add up to the amount being paid now.',
      'If one part is a cheque, the cheque details are captured for that part only.',
      'Loan stays a separate payment type and is not part of a split.',
    ],
    route: '/billing',
    routeLabel: 'Open Billing',
    keywords: ['split', 'two methods', 'part cash', 'mixed payment', 'cash and card', 'cash and cheque', 'combination'],
    section: 'Counter',
  },
  {
    id: 'cheque',
    title: 'Take a cheque payment and track deposit',
    summary: 'Cheque details are saved with the bill, and a deposit reminder appears on the cheque date.',
    steps: [
      'In Billing, choose Cheque as the payment method (or one half of a split).',
      'Enter the cheque number, cheque date and amount.',
      'On the cheque date the reminder appears in the top-bar bell and on the Reminders screen.',
      'When the cheque reaches the bank, press Mark deposited — that records the action, it is not proof the cheque cleared.',
    ],
    route: '/cheques',
    routeLabel: 'Open Reminders',
    keywords: ['cheque', 'check', 'deposit', 'bank', 'cheque number', 'bounced'],
    section: 'Customers & finance',
  },
  {
    id: 'loan',
    title: 'Create a loan for a bill',
    summary: 'Interest-free instalments with due dates, linked to the customer and the bill.',
    steps: [
      'In Billing, choose Loan as the payment type and enter the loan amount.',
      'Set the frequency, number of instalments and first due date.',
      'The loan appears in Loans with its instalment schedule.',
      'Take repayments from Loans or from the customer profile; a repayment can never exceed the balance.',
    ],
    route: '/loans',
    routeLabel: 'Open Loans',
    keywords: ['loan', 'instalment', 'installment', 'credit', 'due date', 'schedule', 'interest free'],
    section: 'Customers & finance',
  },
  {
    id: 'repayment',
    title: 'Collect a loan repayment',
    summary: 'Record a payment against a loan, with receipt number, method and collector.',
    steps: [
      'Open Loans and choose the loan, or open the customer profile and use the Installments tab.',
      'Enter the amount, method, receipt number and date.',
      'The balance and remaining instalments update straight away.',
      'Overpayments are refused, and the entry is written to the audit history.',
    ],
    route: '/loans',
    routeLabel: 'Open Loans',
    keywords: ['repayment', 'collect', 'payment', 'receipt', 'pay back', 'balance', 'instalment payment'],
    section: 'Customers & finance',
  },
  {
    id: 'loan-terms',
    title: 'Change a loan\u2019s instalment terms',
    summary: 'Reschedule a loan without changing payments already made.',
    steps: [
      'Open the loan in Loans and choose Adjust terms.',
      'Set the new frequency, instalment count and first due date.',
      'Payments already made stay exactly as they were; the new schedule starts from the paid point.',
      'Each change is kept as an append-only revision, so the original record is never rewritten.',
    ],
    route: '/loans',
    routeLabel: 'Open Loans',
    keywords: ['adjust terms', 'reschedule', 'change instalments', 'extend loan', 'new due date', 'revise'],
    section: 'Customers & finance',
  },
  {
    id: 'job',
    title: 'Add a repair or custom order job',
    summary: 'Track customer jobs from intake to delivery, with what you charge and what the technician costs you.',
    steps: [
      'Open Jobs and press Add job.',
      'Choose Repair or Custom order (add your own job types with the gear beside the field).',
      'Search for the saved customer, or press Add customer to create one from the form.',
      'Describe the item, weight and problem, set the customer charge and the estimated delivery date.',
      'Take an advance if you want, then move the job through Received, At repairer, Ready and Delivered.',
      'On delivery you are asked for the technician cost if none was recorded, so profit is correct.',
    ],
    route: '/repairs',
    routeLabel: 'Open Jobs',
    keywords: ['job', 'repair', 'custom order', 'design order', 'technician', 'delivery date', 'broken', 'fix'],
    section: 'Counter',
  },
  {
    id: 'job-cost',
    title: 'Record what the technician cost you',
    summary: 'Job profit is what the customer paid minus what you paid the technician.',
    steps: [
      'Open the job in Jobs.',
      'Press Pay technician and enter the cost — this deducts from branch main cash.',
      'Only one technician payment is allowed per job. To correct it, use Edit cost (owner only, with a cash correction).',
      'Jobs report shows charge, technician cost and profit per job.',
    ],
    route: '/repairs',
    routeLabel: 'Open Jobs',
    keywords: ['technician cost', 'repair cost', 'paid technician', 'job profit', 'edit cost', 'outside repairer'],
    section: 'Counter',
  },
  {
    id: 'job-type',
    title: 'Add, rename or remove a job type',
    summary: 'Job types are yours to change; used types cannot be removed.',
    steps: [
      'In the New job form, press the gear beside Job type.',
      'Type a new name to add, or rename an existing one.',
      'To remove one, press delete and confirm with your password.',
      'A job type already used by a job cannot be removed, so history stays intact.',
    ],
    route: '/repairs',
    routeLabel: 'Open Jobs',
    keywords: ['job type', 'add job type', 'rename job type', 'remove job type', 'categories of jobs'],
    section: 'Counter',
  },
  {
    id: 'stock-entry',
    title: 'Add jewellery to stock',
    summary: 'Every piece is unique, with your shop tag, a system number, weight, metal and cost.',
    steps: [
      'Open Stock entry (or Inventory and press Add).',
      'Type your shop tag — duplicates are refused — and the piece name.',
      'Choose the metal, category and weight, then the purchase price and supplier.',
      'A system stock number is generated automatically and shown beside your tag.',
    ],
    route: '/stock-entry',
    routeLabel: 'Open Stock entry',
    keywords: ['add stock', 'new piece', 'item', 'tag', 'system tag', 'weight', 'metal', 'purchase price', 'supplier'],
    section: 'Counter',
  },
  {
    id: 'stock-delete',
    title: 'Edit or delete a stock piece',
    summary: 'Stock has add, edit and delete, restricted by permission, with a password for deletes.',
    steps: [
      'Open Inventory and find the piece.',
      'Press Edit to change details, or Delete to remove it.',
      'Deleting asks for your own login password.',
      'A piece that appears on a bill cannot be deleted — void or return that bill instead.',
    ],
    route: '/inventory',
    routeLabel: 'Open Inventory',
    keywords: ['delete stock', 'edit piece', 'remove item', 'wrong entry', 'stock crud'],
    section: 'Counter',
  },
  {
    id: 'transfer',
    title: 'Move a piece to another branch',
    summary: 'Stock transfers are recorded with an immutable movement entry.',
    steps: [
      'Open Stock transfers.',
      'Choose an in-stock piece and the destination branch.',
      'Add a note and press Transfer piece.',
      'The piece leaves one branch and appears in the other, with the movement in history.',
    ],
    route: '/transfers',
    routeLabel: 'Open Stock transfers',
    keywords: ['transfer', 'move stock', 'another branch', 'send piece', 'branch to branch'],
    section: 'Directories',
  },
  {
    id: 'stock-check',
    title: 'Check stock physically',
    summary: 'Count what is on the shelf and record Found, Missing or Extra without changing stock records.',
    steps: [
      'Open Stock check.',
      'Go through the list marking each piece Found, Missing or Extra.',
      'Review the summary of anything unaccounted for.',
      'Nothing is changed in stock — this is a count you can act on afterwards.',
    ],
    route: '/stock-check',
    routeLabel: 'Open Stock check',
    keywords: ['stock check', 'count', 'physical verification', 'missing piece', 'audit stock', 'tally'],
    section: 'Counter',
  },
  {
    id: 'rates',
    title: 'Set the day\u2019s metal rates',
    summary: 'Rates drive stock value and can be used for weight-based pricing.',
    steps: [
      'Open Today\u2019s rates.',
      'Enter either the rate per gram or per pawn (8 grams); the other figure fills in automatically.',
      'Leading zeros are cleaned up automatically; clearing one field clears both.',
      'Save. The dashboard stock value and the running rates strip update straight away.',
    ],
    route: '/rates',
    routeLabel: 'Open Today\u2019s rates',
    keywords: ['rate', 'gold rate', 'daily rate', 'price per gram', 'pawn', 'stock value', 'metal rate'],
    section: 'Counter',
  },
  {
    id: 'gold-auto',
    title: 'Automatic gold reference rates',
    summary: 'Fetch indicative gold prices hourly, then apply changed reference rates to the four gold purities.',
    steps: [
      'Open Settings and expand Automatic gold-rate fetching under Integrations.',
      'Review the provider note, then enable hourly reference-rate fetching. Silver always stays manual.',
      'Open Today’s rates to inspect the published date, fetched history and applied selling-rate history.',
      'Use Fetch latest rates or Apply rates when needed; existing invoices never change.',
    ],
    route: '/rates',
    routeLabel: 'Open Today’s rates',
    keywords: ['automatic gold', 'gold rates', 'reference rates', 'market rate', 'hourly gold', 'fetch rates'],
    section: 'Counter',
  },
  {
    id: 'recovery',
    title: 'Recover your password',
    summary: 'Verified users can request a single-use email link and choose a new password.',
    steps: [
      'Open Login and press Forgot password.',
      'Enter your verified registered email and press Send reset link.',
      'Open the email link within one hour, enter your authenticator code if enabled, and choose a new password.',
      'If your email is not verified, ask an administrator to send an invitation from User management.',
    ],
    route: '/reset-password',
    routeLabel: 'Open password recovery',
    keywords: ['forgot password', 'reset password', 'recovery', 'email link', 'login', 'password help'],
    section: 'Administration',
  },
  {
    id: 'customer',
    title: 'Add and manage customers',
    summary: 'The customer list shows contact details only; balances and history live inside the profile.',
    steps: [
      'Open Customers and press Add customer.',
      'Type the name and phone; Walk-in is available for counter sales.',
      'Open a customer to see bills, loans, instalments, jobs and repayments together.',
      'Edit the profile from the same screen; past bills stay linked by customer ID.',
    ],
    route: '/customers',
    routeLabel: 'Open Customers',
    keywords: ['customer', 'add customer', 'profile', 'phone', 'walk in', 'outstanding', 'history'],
    section: 'Customers & finance',
  },
  {
    id: 'customer-import',
    title: 'Import or export the customer list',
    summary: 'Bring customers in from a spreadsheet, or take the list out.',
    steps: [
      'Open Customers.',
      'Press Export to download the list with purchase count and last purchase date.',
      'Press Import, choose a CSV or Excel file with Name and Phone, and review the preview.',
      'Rows that are ready are saved; rows with missing fields, duplicate phones or in-file repeats are skipped with a reason.',
      'Use Template to download the correct column layout.',
    ],
    route: '/customers',
    routeLabel: 'Open Customers',
    keywords: ['customer import', 'customer export', 'csv', 'excel', 'bulk customers', 'template'],
    section: 'Customers & finance',
  },
  {
    id: 'expense',
    title: 'Record a branch expense or staff salary',
    summary: 'Expenses come straight out of branch main cash — salaries, rent, supplies — with category, payee and month where needed.',
    steps: [
      'Open Expenses.',
      'Choose a category. Salaries asks for a staff name and a month; other categories follow their own settings.',
      'Press + beside the staff field to add an expense-only payee (shop staff or outside shop, with phone and note).',
      'Enter the amount and note, then save — the cash balance drops immediately.',
      'Overspending the cash balance is refused.',
    ],
    route: '/expenses',
    routeLabel: 'Open Expenses',
    keywords: ['expense', 'spend', 'salary', 'salaries', 'staff salary', 'staff payment', 'rent', 'bill payment', 'petty cash'],
    section: 'Customers & finance',
  },
  {
    id: 'expense-category',
    title: 'Set up expense categories',
    summary: 'Categories are per branch and decide whether staff and month are required.',
    steps: [
      'Open Expenses and press the categories control.',
      'Add a category, or rename an existing one — history keeps the name it was saved with.',
      'Tick Requires staff and Requires month for categories that need them.',
      'A category already used by an expense cannot be deleted.',
    ],
    route: '/expenses',
    routeLabel: 'Open Expenses',
    keywords: ['expense category', 'add category', 'rename category', 'requires staff', 'requires month', 'delete category'],
    section: 'Customers & finance',
  },
  {
    id: 'owner-cash',
    title: 'Owner cash in, cash out and bank movements',
    summary: 'Investment in, drawings out, and bank deposits or withdrawals — kept apart from profit.',
    steps: [
      'Open Branch account.',
      'Press Cash in for owner investment, Cash out for drawings, Bank deposit or Bank withdrawal.',
      'Confirm with your own password; the amount adjusts main cash immediately.',
      'These movements are never counted as profit and appear in their own report and in Daily close.',
    ],
    route: '/account',
    routeLabel: 'Open Branch account',
    keywords: ['cash in', 'cash out', 'drawings', 'investment', 'bank deposit', 'bank withdrawal', 'owner cash', 'take profit'],
    section: 'Customers & finance',
  },
  {
    id: 'currency',
    title: 'Buy and sell foreign currency',
    summary: 'Buying deducts branch main cash; selling adds to it. Balances and realised profit are tracked per branch.',
    steps: [
      'Open Currency exchange.',
      'Press Buy or Sell and choose the currency, amount and rate.',
      'The branch holding and the trade ledger update together.',
      'Add currencies in the Currency directory; used codes cannot be changed, only deactivated.',
    ],
    route: '/currency-exchange',
    routeLabel: 'Open Currency exchange',
    keywords: ['currency', 'foreign currency', 'buy dollars', 'sell dollars', 'exchange', 'usd', 'rate', 'fx'],
    section: 'Customers & finance',
  },
  {
    id: 'old-gold',
    title: 'Buy, sell and move old gold',
    summary: 'Old gold is pooled by purity, separate from tagged jewellery.',
    steps: [
      'Open Old gold.',
      'Record a buy or a sell by purity, weight and pricing — the pool and weighted-average cost update.',
      'Use Transfer to move gold between branches; the weight and cost are preserved and no profit is created.',
      'Old gold reports show holdings, trades and realised profit.',
    ],
    route: '/old-gold',
    routeLabel: 'Open Old gold',
    keywords: ['old gold', 'scrap', 'purity', 'karat', 'buy gold', 'sell gold', 'transfer gold', 'melt'],
    section: 'Customers & finance',
  },
  {
    id: 'reports',
    title: 'Reports, filters and exports',
    summary: 'One Reports screen with every report, useful filters and exports.',
    steps: [
      'Open Reports and choose a tab (daily close, stock, loans, expenses, staff sales, jobs, currency, old gold, owner cash).',
      'Use the filters above the table — period, branch and report-specific ones.',
      'Press Export for the filtered rows as CSV.',
      'Press the general export for one ZIP containing every report you are allowed to see, plus a filter guide.',
    ],
    route: '/reports',
    routeLabel: 'Open Reports',
    keywords: ['report', 'reports', 'export', 'csv', 'zip', 'filter', 'daily close', 'profit', 'summary'],
    section: 'Customers & finance',
  },
  {
    id: 'staff',
    title: 'Add user and set permissions',
    summary: 'The owner creates logins; permissions come from roles and branch assignments.',
    steps: [
      'Open Users & permissions and press Add user.',
      'Type the name, username and verified email address, then choose a role and branches.',
      'Press Send invitation. The user opens the single-use email link and chooses their own password.',
      'Existing users can use Forgot password on the Login page after their email is verified. Owners can still use Reset password when needed.',
      'Only the owner can grant or remove the Administrator role.',
    ],
    route: '/users',
    routeLabel: 'Open Users & permissions',
    keywords: ['staff', 'add staff', 'user', 'username', 'password', 'permissions', 'role', 'administrator', 'access'],
    section: 'Administration',
  },
  {
    id: 'role',
    title: 'Create a role with its own permissions',
    summary: 'Roles decide what each staff member can open and change.',
    steps: [
      'Open Users & permissions and scroll to Roles & permissions.',
      'Press Create role, name it and tick the permissions.',
      'Assign the role to staff from their edit screen.',
      'The Managing Director role is built in: all-branch daily operations and reports, but no deep settings, staff administration, voids or deletes.',
    ],
    route: '/users',
    routeLabel: 'Open Users & permissions',
    keywords: ['role', 'permissions', 'managing director', 'cashier', 'custom role', 'access rights'],
    section: 'Administration',
  },
  {
    id: 'two-factor',
    title: 'Turn on authenticator verification (2FA)',
    summary: 'Optional per person — never forced shop-wide.',
    steps: [
      'Open Users & permissions.',
      'Use the 2FA switch beside a person to request verification.',
      'That person opens their own Profile settings and scans the authenticator QR code.',
      'Turning it off is allowed from the same place, unless your administrator requires it.',
    ],
    route: '/users',
    routeLabel: 'Open Users & permissions',
    keywords: ['2fa', 'two factor', 'authenticator', 'otp', 'verification', 'google authenticator', 'security code'],
    section: 'Administration',
  },
  {
    id: 'settings',
    title: 'Shop settings and bill printing',
    summary: 'Shop identity, country and currency, pricing unit, inactivity logout and printed bill layout.',
    steps: [
      'Open Settings.',
      'Set shop name, address, phone, country and currency — the currency label drives every money amount.',
      'Choose the pricing unit (gram or 8-gram pound) and the inactivity logout time (default one hour).',
      'Under bill printing, add a logo, choose paper size, header and footer, and whether the address, phone and customer phone print.',
    ],
    route: '/settings',
    routeLabel: 'Open Settings',
    keywords: ['settings', 'shop name', 'logo', 'paper size', 'print', 'currency', 'country', 'inactivity', 'logout time', 'footer'],
    section: 'Administration',
  },
  {
    id: 'branches',
    title: 'Add or change a branch',
    summary: 'Branches are the shop\u2019s locations; stock, bills, loans and cash are scoped to them.',
    steps: [
      'Open Administration, then Branches.',
      'Press Add branch and enter the name, code, address and phone.',
      'Deactivate a branch only after moving its remaining stock.',
      'Staff are assigned to branches from Users & permissions.',
    ],
    route: '/branches',
    routeLabel: 'Open Branches',
    keywords: ['branch', 'add branch', 'new location', 'shop code', 'deactivate branch'],
    section: 'Administration',
  },
  {
    id: 'reminder',
    title: 'Add a reminder',
    summary: 'Any note with a date, not just cheques, with full edit and delete.',
    steps: [
      'Open Reminders (the bell in the top bar shows what is due).',
      'Press Add reminder, type the title and note, and pick the date.',
      'Press Mark done when finished.',
      'Branch staff can edit the text, note and date of an open reminder; completed ones are locked.',
    ],
    route: '/cheques',
    routeLabel: 'Open Reminders',
    keywords: ['reminder', 'note', 'date', 'due', 'bell', 'todo', 'follow up'],
    section: 'Customers & finance',
  },
  {
    id: 'audit',
    title: 'See who changed what',
    summary: 'The audit history is append-only and readable by the owner.',
    steps: [
      'Open Administration, then Audit history.',
      'Filter by date, branch or person.',
      'Every sale, payment, expense, job, stock change, reset and password action appears with a Colombo timestamp.',
      'Audit rows cannot be edited or deleted from the app.',
    ],
    route: '/audit',
    routeLabel: 'Open Audit history',
    keywords: ['audit', 'history', 'who did', 'log', 'trail', 'changed what'],
    section: 'Administration',
  },
  {
    id: 'void',
    title: 'Void a bill or return pieces',
    summary: 'Voids and returns keep the original bill and correct every total.',
    steps: [
      'Open Sales history and find the bill.',
      'Press Void to cancel the whole bill, or Return to send back selected pieces.',
      'Confirm with your own password.',
      'Stock, loans, receipts and cash are adjusted, and the original bill stays visible.',
    ],
    route: '/sales',
    routeLabel: 'Open Sales history',
    keywords: ['void', 'cancel bill', 'return', 'refund', 'wrong sale', 'reverse', 'delete sale'],
    section: 'Counter',
  },
  {
    id: 'theme',
    title: 'Dark or light look, calculator and phone install',
    summary: 'Small everyday controls.',
    steps: [
      'Use the theme switch in the top bar for dark or light; it is remembered on that device.',
      'Press the calculator button beside the bell to open a floating calculator you can move, minimise and read history from.',
      'On a phone, open the browser menu and choose Add to Home Screen to install KaratDesk like an app.',
    ],
    route: '/dashboard',
    routeLabel: 'Open Dashboard',
    keywords: ['dark mode', 'light mode', 'theme', 'calculator', 'install', 'home screen', 'phone app', 'shortcut'],
    section: 'Counter',
  },
  {
    id: 'import-export',
    title: 'Import stock from a spreadsheet',
    summary: 'Validate first, then save reviewed rows one by one.',
    steps: [
      'Open Import / export.',
      'Press Template to get the correct column layout.',
      'Press Choose CSV or Excel and select a file with up to 500 stock rows.',
      'Fix any rows marked as needing correction, then press Import reviewed rows.',
      'Progress is shown row by row, so a stop halfway is clear.',
    ],
    route: '/import-export',
    routeLabel: 'Open Import / export',
    keywords: ['import stock', 'csv import', 'excel import', 'bulk stock', 'template', 'spreadsheet'],
    section: 'Administration',
  },
];

const STOP_WORDS = new Set([
  'how', 'do', 'i', 'to', 'the', 'a', 'an', 'is', 'of', 'for', 'on', 'in', 'and', 'my', 'we', 'can',
  'please', 'where', 'what', 'with', 'this', 'that', 'it', 'me', 'you', 'your', 'should', 'would',
  'get', 'want', 'need', 'am', 'are', 'be', 'there', 'from', 'about', 'tell', 'show', 'me',
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export type HelpMatch = { topic: HelpTopic; score: number };

/** Rank the guide against a plain-language question. */
export function matchHelp(query: string, limit = 3): HelpMatch[] {
  const words = tokens(query);
  if (!words.length) return [];
  const phrase = query.toLowerCase();
  const scored = HELP_TOPICS.map((topic) => {
    let score = 0;
    for (const word of words) {
      if (topic.keywords.some((keyword) => keyword === word)) score += 4;
      else if (topic.keywords.some((keyword) => keyword.includes(word))) score += 2;
      if (topic.title.toLowerCase().includes(word)) score += 3;
      if (topic.summary.toLowerCase().includes(word)) score += 1;
      if (topic.steps.some((step) => step.toLowerCase().includes(word))) score += 1;
    }
    // A whole phrase in the keywords is a strong signal ("factory reset").
    if (topic.keywords.some((keyword) => keyword.includes(' ') && phrase.includes(keyword))) score += 6;
    return { topic, score };
  });
  return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export const HELP_SECTIONS = Array.from(new Set(HELP_TOPICS.map((topic) => topic.section)));
