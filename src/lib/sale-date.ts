// Sale-date rules: a bill may be recorded on the day it actually happened, which can
// be earlier than the day it is entered, but never in the future.
export function saleDateError(date: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter a valid sale date';
  if (date > today) return 'The sale date cannot be in the future';
  if (date < '2000-01-01') return 'The sale date is too far in the past';
  return null;
}
