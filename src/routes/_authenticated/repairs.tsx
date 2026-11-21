import {createFileRoute} from '@tanstack/react-router';
import {RepairJobs} from '@/components/pos/repairs';
export const Route=createFileRoute('/_authenticated/repairs')({head:()=>({meta:[{title:'Jobs | KaratDesk'},{name:'description',content:'Track jewellery repairs and custom design orders from intake to delivery.'},{property:'og:title',content:'Jobs | KaratDesk'},{property:'og:description',content:'Repair intake, delivery dates, repairer costs and repair profit.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:RepairJobs});
