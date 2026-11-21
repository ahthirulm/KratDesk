import {it,expect} from 'vitest';
import {SHOP_BRANCHES} from '@/lib/branches';
it('names the main branch City Jewels',()=>expect(SHOP_BRANCHES.find(b=>b.code==='B1')?.name).toBe('City Jewels'));
it('names the second branch Alishara jewelers',()=>expect(SHOP_BRANCHES.find(b=>b.code==='B2')?.name).toBe('Alishara jewelers'));
