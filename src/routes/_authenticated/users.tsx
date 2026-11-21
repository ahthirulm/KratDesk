import {createFileRoute} from '@tanstack/react-router';
import {UserManagement} from '@/components/pos/users';
import {usePos} from '@/components/pos/data';
export const Route=createFileRoute('/_authenticated/users')({head:()=>({meta:[{title:'User management | KaratDesk'},{name:'description',content:'Staff accounts, branch assignments and account status for the jewellery shop.'},{property:'og:title',content:'User management | KaratDesk'},{property:'og:description',content:'Manage your jewellery shop team across both branches.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Screen});
function Screen(){const {data,loading}=usePos();if(loading)return <p>Loading staff…</p>;if(!data.demo&&!data.admin)return <div className="access-denied"><h1>Admin access required</h1></div>;return <UserManagement/>}
