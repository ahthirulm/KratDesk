import { describe, expect, it } from 'vitest';
import { factoryResetReady } from '@/lib/factory-reset';

describe('factory reset confirmation', () => {
  it('is not ready without the typed wording', () => {
    expect(factoryResetReady('', 'hunter2hunter2')).toBe(false);
    expect(factoryResetReady('reset', 'hunter2hunter2')).toBe(false);
    expect(factoryResetReady('FACTORY REST', 'hunter2hunter2')).toBe(false);
  });

  it('is not ready without the owner password', () => {
    expect(factoryResetReady('FACTORY RESET', '')).toBe(false);
  });

  it('accepts the wording with different spacing or case, plus a password', () => {
    expect(factoryResetReady('factory reset', 'hunter2hunter2')).toBe(true);
    expect(factoryResetReady('  FACTORY RESET  ', 'hunter2hunter2')).toBe(true);
  });
});
