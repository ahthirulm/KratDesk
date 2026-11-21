import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ArrowRightLeft, ChartNoAxesCombined, Scale, CalendarCheck, Package, Hourglass, Wallet, UsersRound, Landmark, Wrench, FolderArchive, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ReportTab } from '@/lib/report-tabs';
import { usePos } from './data';
import { CurrencyReports } from './currency-exchange';
import { OldGoldReports } from './old-gold';
import { Reports } from './reports';
import { DailyCloseReport, StockReport, LoanAgeReport, ExpenseReport, StaffSalesReport } from './shop-reports';
import { Empty, PageTitle } from './shared';
import { RepairReport } from './repairs';
import { OwnerCashReport, useOwnerCash } from './owner-cash';
import { ReportExportProvider, useGeneralReportExport } from './report-export';

export function ReportsHub(props: { active?: ReportTab | undefined; from?: string | undefined; to?: string | undefined }) {
  return <ReportExportProvider><ReportsWorkspace {...props} /></ReportExportProvider>;
}

function ReportsWorkspace({ active, from, to }: { active?: ReportTab | undefined; from?: string | undefined; to?: string | undefined }) {
  const { can, branch, branches } = usePos();
  const ownerCash = useOwnerCash(branch);
  const exportGeneral = useGeneralReportExport();
  const tabs: { id: ReportTab; label: string; icon: LucideIcon; allowed: boolean }[] = [
    { id: 'jewellery', label: 'Jewellery sales', icon: ChartNoAxesCombined, allowed: can('View reports') },
    { id: 'daily-close', label: 'Daily close', icon: CalendarCheck, allowed: can('View reports') },
    { id: 'stock', label: 'Stock', icon: Package, allowed: can('View reports') },
    { id: 'loan-age', label: 'Loan ageing', icon: Hourglass, allowed: can('View reports') },
    { id: 'expenses', label: 'Expenses', icon: Wallet, allowed: can('View reports') },
    { id: 'staff', label: 'Staff sales', icon: UsersRound, allowed: can('View reports') },
    { id: 'repairs', label: 'Jobs', icon: Wrench, allowed: can('View reports') && can('Create bills') },
    { id: 'owner-cash', label: 'Owner cash & bank', icon: Landmark, allowed: ownerCash.allowed },
    { id: 'currency', label: 'Currency exchange', icon: ArrowRightLeft, allowed: can('View currency reports') || can('Manage currency exchange') },
    { id: 'old-gold', label: 'Old gold', icon: Scale, allowed: can('View reports') && can('View costs and profit') },
  ];
  const available = tabs.filter(tab => tab.allowed);
  const selected: ReportTab = active && available.some(tab => tab.id === active) ? active : available[0]?.id || 'jewellery';

  const panels: Record<ReportTab, ReactNode> = {
    jewellery: <Reports embedded initialFrom={from} initialTo={to} />,
    'daily-close': <DailyCloseReport initialDate={to || from} />,
    stock: <StockReport />,
    'loan-age': <LoanAgeReport />,
    expenses: <ExpenseReport initialFrom={from} initialTo={to} />,
    staff: <StaffSalesReport initialFrom={from} initialTo={to} />,
    repairs: <RepairReport initialFrom={from} initialTo={to} />,
    'owner-cash': <OwnerCashReport initialFrom={from} initialTo={to} />,
    currency: <CurrencyReports embedded initialFrom={from} initialTo={to} />,
    'old-gold': <OldGoldReports embedded initialFrom={from} initialTo={to} />,
  };

  return <>
    <PageTitle title="Reports" subtitle="Detailed records, flexible filters and matching CSV exports for every area." actions={available.length > 0 && <Button variant="outline" onClick={() => {
      try { exportGeneral(available.map(tab => tab.id), branch, branches.find(item => item.id === branch)?.name || branch); toast.success('General report ZIP downloaded'); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not export reports'); }
    }}><FolderArchive />Export all reports (ZIP)</Button>} />
    {available.length ? <>
      <div className="report-tabs" role="tablist" aria-label="Report sections">
        {available.map(tab => <Button key={tab.id} asChild variant={selected === tab.id ? 'default' : 'outline'} className="report-tab" role="tab" aria-selected={selected === tab.id}>
          <Link to="/reports" search={{ report: tab.id, ...(from ? { from } : {}), ...(to ? { to } : {}) }}><tab.icon />{tab.label}</Link>
        </Button>)}
      </div>
      {available.map(tab => <div key={tab.id} className="report-panel" role="tabpanel" aria-label={tab.label} hidden={selected !== tab.id}>
        {panels[tab.id]}
      </div>)}
    </> : <Empty title="Report access required" description="Ask an administrator for permission to view shop reports." />}
  </>;
}
