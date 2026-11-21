import {createContext,useContext,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {usePos} from './data';
import {validateProfile,validateAvatar} from '@/lib/profile-rules';
type PersonalProfile={display_name:string;username:string|null;mfa_enabled:boolean;two_factor_required:boolean;phone:string;avatar_path:string|null;photo:string};
const initial:PersonalProfile={display_name:'Your jewellery shop',username:null,mfa_enabled:false,two_factor_required:false,phone:'',avatar_path:null,photo:''};
const Context=createContext<{profile:PersonalProfile;loading:boolean;error:string;save:(name:string,phone:string,file:File|null,remove:boolean)=>Promise<void>}|null>(null);
export function ProfileProvider({children}:{children:ReactNode}){
 const {data,refresh}=usePos();const client=useQueryClient();const [sample,setSample]=useState(initial);
 const query=useQuery({queryKey:['personal-profile',data.user?.id],enabled:!!data.user&&!data.demo,queryFn:async()=>{
  if(!data.user)throw new Error('Login to edit your profile');
  const {data:row,error}=await supabase.from('profiles').select('display_name,username,mfa_enabled,two_factor_required,phone,avatar_path').eq('id',data.user.id).single();if(error)throw error;
  let photo='';if(row.avatar_path){const result=await supabase.storage.from('staff-avatars').createSignedUrl(row.avatar_path,3600);if(result.error)throw result.error;photo=result.data.signedUrl;}
  return {...row,photo};
 },staleTime:1800000});
 const profile=data.demo?sample:query.data||{...initial,display_name:data.name};
 async function save(name:string,phone:string,file:File|null,remove:boolean){
  const fields=validateProfile(name,phone);if(file)validateAvatar(file);
  if(data.demo){let photo=remove?'':sample.photo;if(file)photo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Photo could not be read'));reader.onerror=()=>reject(new Error('Photo could not be read'));reader.readAsDataURL(file)});setSample({...sample,...fields,photo});return;}
  if(!data.user)throw new Error('Login to edit your profile');
  let path=remove?null:profile.avatar_path;let uploaded:string|null=null;
  if(file){const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';uploaded=`${data.user.id}/${crypto.randomUUID()}.${ext}`;const result=await supabase.storage.from('staff-avatars').upload(uploaded,file,{contentType:file.type});if(result.error)throw result.error;path=uploaded;}
  const result=await supabase.from('profiles').update({...fields,avatar_path:path}).eq('id',data.user.id).select('id').single();
  if(result.error){if(uploaded)await supabase.storage.from('staff-avatars').remove([uploaded]);throw result.error;}
  if(profile.avatar_path&&profile.avatar_path!==path)await supabase.storage.from('staff-avatars').remove([profile.avatar_path]);
  await Promise.all([client.invalidateQueries({queryKey:['personal-profile']}),refresh()]);
 }
 return <Context.Provider value={{profile,loading:!!data.user&&query.isPending,error:query.error?.message||'',save}}>{children}</Context.Provider>;
}
export function useProfile(){const context=useContext(Context);if(!context)throw new Error('Profile provider required');return context;}