export const STOCK_CATEGORIES=['Ring','Earring','Bangles','Necklace','Chain','Pendant','Bracelet','Anklet','Other'] as const;
export function isStockCategory(value:string){return STOCK_CATEGORIES.some(category=>category===value);}
export function changeCategories<T extends {category:string;status:string}>(categories:string[],items:T[],oldName:string|null,newName:string|null){
 const clean=newName?.trim()||null;
 if(!oldName&&!clean)throw new Error('Enter a category name');
 if(oldName&&!categories.includes(oldName))throw new Error('Category not found');
 if(clean&&categories.some(c=>c!==oldName&&c.toLowerCase()===clean.toLowerCase()))throw new Error('This category already exists');
 if(oldName&&!clean&&items.some(i=>i.category===oldName))throw new Error('This category is used by stock and cannot be removed');
 return {categories:oldName?categories.flatMap(c=>c===oldName?(clean?[clean]:[]):[c]):[...categories,...(clean?[clean]:[])],items:items.map(i=>oldName&&clean&&i.category===oldName&&i.status==='In Stock'?{...i,category:clean}:i)};
}