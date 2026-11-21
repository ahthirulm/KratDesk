import {expect,it} from 'vitest';
import {validateProfile,validateAvatar} from '@/lib/profile-rules';
it('requires a personal name and normalises contact details',()=>{expect(validateProfile('  Ahthir  ',' 0771234567 ')).toEqual({display_name:'Ahthir',phone:'0771234567'});expect(()=>validateProfile(' ','')).toThrow()});
it('accepts supported profile photos and rejects other files',()=>{expect(()=>validateAvatar({type:'image/png',size:100})).not.toThrow();expect(()=>validateAvatar({type:'image/svg+xml',size:100})).toThrow()});
it('caps profile photos at two megabytes',()=>{expect(()=>validateAvatar({type:'image/jpeg',size:2097152})).not.toThrow();expect(()=>validateAvatar({type:'image/jpeg',size:2097153})).toThrow()});