export type DemoUser={id:string;name:string;username:string;role:string;branch:string;active:boolean;twoFactorRequired?:boolean;mfaEnabled?:boolean};
export const DEMO_USERS:DemoUser[]=[
{id:'sample-owner',name:'Sample Owner',username:'sample.owner',role:'Super Admin',branch:'All branches',active:true},
{id:'sample-manager-b1',name:'Sample · City Jewels Manager',username:'sample.city.manager',role:'Branch Manager',branch:'B1',active:true},
{id:'sample-manager-b2',name:'Sample · Alishara Manager',username:'sample.alishara.manager',role:'Branch Manager',branch:'B2',active:true},
{id:'sample-cashier-b1',name:'Sample · City Jewels Cashier',username:'sample.city.cashier',role:'Cashier',branch:'B1',active:true},
{id:'sample-cashier-b2',name:'Sample · Alishara Cashier',username:'sample.alishara.cashier',role:'Cashier',branch:'B2',active:true},
{id:'sample-inactive',name:'Sample · Former Cashier',username:'sample.inactive',role:'Cashier',branch:'B1',active:false},
];
