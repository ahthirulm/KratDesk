import {createFileRoute} from '@tanstack/react-router';
import {StockEntry} from '@/components/pos/stock';
import {LOGIN_ENABLED} from '@/lib/access-mode';
import {usePos} from '@/components/pos/data';
export const Route=createFileRoute('/_authenticated/stock-entry')({head:()=>({meta:[{title:'Stock entry | KaratDesk'},{name:'description',content:'Manage stock entry in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Stock entry | KaratDesk'},{property:'og:description',content:'Secure jewellery shop stock entry.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Screen});
function Screen(){const {data,loading,can}=usePos();if(loading)return <p>Loading shop…</p>;if(LOGIN_ENABLED&&!can('Manage stock'))return <div className="access-denied"><h1>Admin access required</h1><p>This page is available to the shop administrator.</p></div>;return <StockEntry/>}
