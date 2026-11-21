import {createFileRoute} from '@tanstack/react-router';
import {Inventory} from '@/components/pos/stock';
export const Route=createFileRoute('/_authenticated/inventory')({head:()=>({meta:[{title:'Inventory | KaratDesk'},{name:'description',content:'Manage inventory in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Inventory | KaratDesk'},{property:'og:description',content:'Secure jewellery shop inventory.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Inventory});
