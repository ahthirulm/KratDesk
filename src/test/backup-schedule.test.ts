import { describe, it, expect } from 'vitest';
import { nextSlotAfter, nextRunAfterRun, isDue, parseRecipients } from '@/lib/backup-schedule';

describe('scheduled backup timing (Colombo)', () => {
  it('2 AM Colombo is 20:30 UTC the day before', () => {
    expect(nextSlotAfter(new Date('2026-11-17T14:30:00Z'), 2).toISOString()).toBe('2026-11-17T20:30:00.000Z');
  });
  it('every 2 days runs two days after the last run', () => {
    expect(nextRunAfterRun(new Date('2026-11-17T20:30:05Z'), 2, 2).toISOString()).toBe('2026-11-19T20:30:00.000Z');
  });
  it('off schedules are never due', () => {
    expect(isDue(new Date('2027-01-01Z'), '2026-01-01T00:00:00Z', false)).toBe(false);
    expect(isDue(new Date('2027-01-01Z'), '2026-01-01T00:00:00Z', true)).toBe(true);
  });
  it('dedupes recipients', () => {
    expect(parseRecipients('A@x.lk, a@x.lk; b@y.lk')).toEqual(['a@x.lk', 'b@y.lk']);
  });
});
