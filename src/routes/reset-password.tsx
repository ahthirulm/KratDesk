import {createFileRoute} from '@tanstack/react-router';
import {AccountRecovery as ResetPassword} from '@/components/pos/account-recovery';
export const Route=createFileRoute('/reset-password')({head:()=>({meta:[{title:'Reset password | KaratDesk'},{name:'description',content:'Password help for KaratDesk staff accounts.'},{property:'og:title',content:'Reset password | KaratDesk'},{property:'og:description',content:'Secure staff access for your jewellery shop.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:ResetPassword});
