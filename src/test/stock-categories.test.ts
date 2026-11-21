import {expect,it} from 'vitest';
import {isStockCategory,changeCategories} from '@/lib/stock-categories';
it.each(['Ring','Earring','Bangles'])('accepts the requested category %s',category=>expect(isStockCategory(category)).toBe(true));
it('rejects an unknown category',()=>expect(isStockCategory('Not jewellery')).toBe(false));
it('adds a new stock category',()=>expect(changeCategories(['Ring'],[],null,'Brooch').categories).toContain('Brooch'));
it('renames unsold stock without changing sold pieces',()=>expect(changeCategories(['Ring'],[{category:'Ring',status:'In Stock'},{category:'Ring',status:'Sold'}],'Ring','Rings').items.map(i=>i.category)).toEqual(['Rings','Ring']));
it('blocks removal of a category still used by stock',()=>expect(()=>changeCategories(['Ring'],[{category:'Ring',status:'Sold'}],'Ring',null)).toThrow('used by stock'));
it('removes an unused category',()=>expect(changeCategories(['Ring','Brooch'],[],'Brooch',null).categories).toEqual(['Ring']));