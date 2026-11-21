import { describe, expect, it } from 'vitest';
import { parseCustomerImport } from '@/lib/customer-import';

describe('customer import', () => {
  it('accepts a valid row', () => {
    expect(parseCustomerImport([{ Name: 'Nimal', Phone: '0771234567' }], [])[0]).toEqual({ row: 2, name: 'Nimal', phone: '0771234567', errors: [] });
  });
  it('rejects phones already saved', () => {
    expect(parseCustomerImport([{ Name: 'A', Phone: '077' }], ['077'])[0]?.errors).toEqual(['Phone already saved']);
  });
  it('rejects duplicate phones within the file', () => {
    expect(parseCustomerImport([{ Name: 'A', Phone: '1' }, { Name: 'B', Phone: '1' }], [])[1]?.errors).toEqual(['Duplicate phone in file']);
  });
  it('requires name and phone', () => {
    expect(parseCustomerImport([{ Name: '', Phone: '' }], [])[0]?.errors).toEqual(['Name missing', 'Phone missing']);
  });
});
