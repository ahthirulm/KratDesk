import {createFileRoute} from '@tanstack/react-router';
import {Customers} from '@/components/pos/customers';
export const Route=createFileRoute('/_authenticated/customers')({head:()=>({meta:[{title:'Customers | KaratDesk'},{name:'description',content:'Manage customers in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Customers | KaratDesk'},{property:'og:description',content:'Secure jewellery shop customers.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Customers});
