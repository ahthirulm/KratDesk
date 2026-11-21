import {createFileRoute} from '@tanstack/react-router';
import {Settings} from '@/components/pos/settings';
import {LOGIN_ENABLED} from '@/lib/access-mode';
import {usePos} from '@/components/pos/data';
export const Route=createFileRoute('/_authenticated/settings')({head:()=>({meta:[{title:'Settings | KaratDesk'},{name:'description',content:'Manage settings in your Sri Lankan jewellery shop.'},{property:'og:title',content:'Settings | KaratDesk'},{property:'og:description',content:'Secure jewellery shop settings.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Screen});
function Screen(){const {data,loading}=usePos();if(loading)return <p>Loading shop…</p>;if(LOGIN_ENABLED&&!data.admin)return <div className="access-denied"><h1>Admin access required</h1><p>This page is available to the shop administrator.</p></div>;return <Settings/>}
