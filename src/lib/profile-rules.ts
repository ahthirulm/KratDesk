export function validateProfile(name:string,phone:string){
 if(!name.trim()||name.trim().length>100)throw new Error('Enter a name of 1–100 characters');
 if(phone.trim().length>30)throw new Error('Phone number is too long');
 return {display_name:name.trim(),phone:phone.trim()};
}
export function validateAvatar(file:{size:number;type:string}){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP photo');
 if(file.size>2*1024*1024)throw new Error('Choose a photo smaller than 2 MB');
}