import {createFileRoute} from '@tanstack/react-router';
import {StockCheck} from '@/components/pos/stock-check';
export const Route=createFileRoute('/_authenticated/stock-check')({head:()=>({meta:[{title:'Stock check | KaratDesk'},{name:'description',content:'Scan shelf tags and find missing or extra jewellery pieces.'},{property:'og:title',content:'Stock check | KaratDesk'},{property:'og:description',content:'Count branch stock by scanning tags.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:StockCheck});
