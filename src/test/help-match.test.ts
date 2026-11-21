import { describe, expect, it } from 'vitest';
import { HELP_TOPICS, matchHelp } from '@/lib/help-topics';

const top = (query: string) => matchHelp(query, 1)[0]?.topic.id;

describe('help answers match real screens', () => {
  it('points a reset question at the factory reset guide', () => {
    expect(top('how do i reset the shop')).toBe('reset');
    expect(top('factory reset please')).toBe('reset');
    expect(top('i want to wipe all data')).toBe('reset');
  });

  it('finds backup, restore and split payment guides', () => {
    expect(top('where do i take a backup')).toBe('backup');
    expect(top('how do i restore from a backup file')).toBe('restore');
    expect(top('can i pay with cash and card together')).toBe('split');
  });

  it('finds day-to-day work: salary expense, repair cost, stock transfer', () => {
    expect(top('where do i add staff salary')).toBe('expense');
    expect(top('we paid the technician where do i enter that')).toBe('job-cost');
    expect(top('move a piece to another branch')).toBe('transfer');
  });

  it('finds password recovery and automatic gold-rate guides', () => {
    expect(top('forgot password')).toBe('recovery');
    expect(top('automatic gold rates')).toBe('gold-auto');
  });

  it('returns nothing for a question with no useful words', () => {
    expect(matchHelp('')).toEqual([]);
    expect(matchHelp('how do i')).toEqual([]);
  });

  it('every guide has steps and a real screen to open', () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.steps.length).toBeGreaterThanOrEqual(3);
      expect(topic.route.startsWith('/')).toBe(true);
      expect(topic.keywords.length).toBeGreaterThan(3);
    }
  });
});
