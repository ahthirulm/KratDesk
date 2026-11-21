import { expect, it } from 'vitest';
import { createDemoStore } from '@/lib/demo-data';
import { dashboardOverall,dashboardRange } from '@/lib/dashboard';

it('shows all-time sales and profit with current stock count and exact weight', () => {
  expect(dashboardOverall(createDemoStore('B1', '2026-11-17'))).toEqual({
    sales: 1465383.85,
    profit: 166177.55,
    stockCount: 12,
    stockWeight: 111.35,
  });
});

it('uses the selected month for sales and profit while stock remains current',()=>{
 const range=dashboardRange('month','2026-11-17');
 expect(range).toEqual({from:'2026-11-01',to:'2026-11-17'});
 expect(dashboardOverall(createDemoStore('B1','2026-11-17'),range.from,range.to)).toEqual({sales:827802.85,profit:93874.55,stockCount:12,stockWeight:111.35});
});

it('provides today, year and all-time ranges',()=>{
 expect(dashboardRange('today','2026-11-17')).toEqual({from:'2026-11-17',to:'2026-11-17'});
 expect(dashboardRange('year','2026-11-17')).toEqual({from:'2026-01-01',to:'2026-11-17'});
 expect(dashboardRange('all','2026-11-17')).toEqual({from:'',to:''});
});
