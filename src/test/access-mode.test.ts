import {it,expect} from 'vitest';
import {LOGIN_ENABLED} from '@/lib/access-mode';
it('requires staff authentication for the live workspace',()=>expect(LOGIN_ENABLED).toBe(true));
