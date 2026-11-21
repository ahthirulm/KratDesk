import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INACTIVITY_MINUTES,
  internalLoginEmail,
  normalizeUsername,
  remainingInactivityMs,
  validateInactivityMinutes,
  validatePassword,
} from '@/lib/security-rules';

describe('staff credentials', () => {
  it('normalises usernames and creates an internal login address', () => {
    expect(normalizeUsername('  Ahthir.Owner ')).toBe('ahthir.owner');
    expect(internalLoginEmail('Ahthir.Owner')).toBe('ahthir.owner@app.local');
  });

  it('rejects unsafe or ambiguous usernames', () => {
    expect(() => normalizeUsername('ab')).toThrow();
    expect(() => normalizeUsername('owner@example.com')).toThrow();
    expect(() => normalizeUsername('two words')).toThrow();
  });

  it('requires a useful password without storing or transforming it', () => {
    expect(validatePassword('Counter123')).toBe('Counter123');
    expect(() => validatePassword('short1')).toThrow();
    expect(() => validatePassword('onlyletters')).toThrow();
    expect(() => validatePassword('1234567890')).toThrow();
  });
});

describe('inactivity logout', () => {
  it('defaults to the requested one hour', () => {
    expect(DEFAULT_INACTIVITY_MINUTES).toBe(60);
    expect(remainingInactivityMs(0, 30 * 60_000)).toBe(30 * 60_000);
  });

  it('expires exactly at the configured deadline', () => {
    expect(remainingInactivityMs(1_000, 1_000 + 60 * 60_000)).toBe(0);
    expect(remainingInactivityMs(1_000, 1_000 + 15 * 60_000, 15)).toBe(0);
  });

  it('accepts only bounded whole-minute settings', () => {
    expect(validateInactivityMinutes(480)).toBe(480);
    expect(() => validateInactivityMinutes(4)).toThrow();
    expect(() => validateInactivityMinutes(481)).toThrow();
    expect(() => validateInactivityMinutes(30.5)).toThrow();
  });
});
