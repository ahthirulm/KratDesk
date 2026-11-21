import {createFileRoute} from '@tanstack/react-router';
import {BranchManagement} from '@/components/pos/central';
export const Route=createFileRoute('/_authenticated/branches')({head:()=>({meta:[{title:'Branches | KaratDesk'},{name:'description',content:'Branches across your jewellery shop branches.'},{property:'og:title',content:'Branches | KaratDesk'},{property:'og:description',content:'Central control across all your jewellery shop branches.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:BranchManagement});
