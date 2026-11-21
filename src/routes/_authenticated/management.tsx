import {createFileRoute} from '@tanstack/react-router';
import {CentralManagement} from '@/components/pos/central';
export const Route=createFileRoute('/_authenticated/management')({head:()=>({meta:[{title:'Administration | KaratDesk'},{name:'description',content:'Administration across your jewellery shop branches.'},{property:'og:title',content:'Administration | KaratDesk'},{property:'og:description',content:'Central control across all your jewellery shop branches.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:CentralManagement});
