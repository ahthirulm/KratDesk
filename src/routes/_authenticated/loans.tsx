import {createFileRoute} from '@tanstack/react-router';
import {Loans} from '@/components/pos/loans';
export const Route=createFileRoute('/_authenticated/loans')({head:()=>({meta:[{title:'Loans | KaratDesk'},{name:'description',content:'Manage loans in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Loans | KaratDesk'},{property:'og:description',content:'Secure jewellery shop loans.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Loans});
