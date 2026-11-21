export const DEFAULT_PETTY_CATEGORIES=['Salaries','Refreshments','Transport','Utilities','Stationery','Repairs','Other'];
export type PettyCategory={id:string;branch_id:string;name:string;requires_staff?:boolean;requires_month?:boolean};
export type CategoryRequirements={requires_staff?:boolean;requires_month?:boolean};
export function changePettyCategory(categories:PettyCategory[],entries:{branch_id:string;category:string;category_id?:string|null}[],branch:string,id:string|null,name:string|null,requirements:CategoryRequirements={}){
 const old=categories.find(c=>c.id===id&&c.branch_id===branch);
 if(id&&!old)throw new Error('Category not found in this branch');
 if(name===null){if(!old)throw new Error('Choose a category');if(entries.some(e=>e.category_id===id||(e.branch_id===branch&&e.category===old.name)))throw new Error('This category is used by expenses and cannot be removed');return categories.filter(c=>c.id!==id);}
 const clean=name.trim();if(!clean)throw new Error('Enter a category name');
 if(categories.some(c=>c.branch_id===branch&&c.id!==id&&c.name.toLowerCase()===clean.toLowerCase()))throw new Error('This category already exists');
 const salary=['salary','salaries'].includes(clean.toLowerCase());
 return [...categories.filter(c=>c.id!==id),{id:id||crypto.randomUUID(),branch_id:branch,name:clean,requires_staff:requirements.requires_staff??old?.requires_staff??salary,requires_month:requirements.requires_month??old?.requires_month??salary}];
}