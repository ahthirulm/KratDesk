import {createFileRoute} from '@tanstack/react-router';
import {Rates} from '@/components/pos/rates';
export const Route=createFileRoute('/_authenticated/rates')({head:()=>({meta:[{title:'Today’s rates | KaratDesk'},{name:'description',content:'Manage today’s rates in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Today’s rates | KaratDesk'},{property:'og:description',content:'Secure jewellery shop daily metal rates.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Rates});
