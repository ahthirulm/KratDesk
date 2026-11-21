import {createFileRoute} from '@tanstack/react-router';
import {SystemHealth} from '@/components/pos/system-health';
export const Route=createFileRoute('/_authenticated/system-health')({head:()=>({meta:[{title:'System health | KaratDesk'},{name:'description',content:'Owner view of server health, errors and storage.'},{property:'og:title',content:'System health | KaratDesk'},{property:'og:description',content:'Server status, error log and storage history for the shop owner.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:SystemHealth});
