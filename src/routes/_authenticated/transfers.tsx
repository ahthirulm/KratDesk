import {createFileRoute} from '@tanstack/react-router';
import {Transfers} from '@/components/pos/central';
export const Route=createFileRoute('/_authenticated/transfers')({head:()=>({meta:[{title:'Stock transfers | KaratDesk'},{name:'description',content:'Stock transfers across your jewellery shop branches.'},{property:'og:title',content:'Stock transfers | KaratDesk'},{property:'og:description',content:'Central control across all your jewellery shop branches.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Transfers});
