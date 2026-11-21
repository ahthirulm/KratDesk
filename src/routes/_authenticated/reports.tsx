import { createFileRoute } from '@tanstack/react-router';
import { ReportsHub } from '@/components/pos/report-hub';
import { LOGIN_ENABLED } from '@/lib/access-mode';
import { reportTab } from '@/lib/report-tabs';
import { reportDate } from '@/lib/report-period';
import { usePos } from '@/components/pos/data';

export const Route = createFileRoute('/_authenticated/reports')({
  validateSearch: (search) => {
    const report = reportTab(search['report']);
    const from = reportDate(search['from']);
    const to = reportDate(search['to']);
    return { ...(report ? { report } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
  },
  head: () => ({ meta: [
    { title: 'Reports | KaratDesk' },
    { name: 'description', content: 'Filter detailed jewellery, stock, loan, expense, job, owner-cash, currency and old-gold reports, then export matching CSV files.' },
    { property: 'og:title', content: 'Reports | KaratDesk' },
    { property: 'og:description', content: 'Detailed branch reports with flexible filters, filtered CSV downloads and a general ZIP export.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Screen,
});

function Screen() {
  const { loading, can } = usePos();
  const { report, from, to } = Route.useSearch();
  if (loading) return <p>Loading shop…</p>;
  if (LOGIN_ENABLED && !can('View reports') && !can('View currency reports') && !can('Manage currency exchange')) {
    return <div className="access-denied"><h1>Report access required</h1><p>Ask an administrator for permission to view shop reports.</p></div>;
  }
  return <ReportsHub active={report} from={from} to={to} />;
}
