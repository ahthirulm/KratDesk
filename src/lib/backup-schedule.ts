// Pure timing rules for scheduled email backups. Times use Asia/Colombo (UTC+5:30, no DST).
const COLOMBO_OFFSET_MS = 330 * 60 * 1000;
const DAY = 86400000;

/** Next moment (UTC) at `hour`:00 Colombo time that is strictly after `now`. */
export function nextSlotAfter(now: Date, hour: number): Date {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const slotLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour);
  let slot = slotLocal - COLOMBO_OFFSET_MS;
  if (slot <= now.getTime()) slot += DAY;
  return new Date(slot);
}

/** After a run, the next one is `everyDays` later at the same Colombo hour. */
export function nextRunAfterRun(ranAt: Date, everyDays: number, hour: number): Date {
  const base = nextSlotAfter(ranAt, hour);
  return new Date(base.getTime() + (everyDays - 1) * DAY);
}

export function isDue(now: Date, nextRunAt: string | null, enabled: boolean): boolean {
  return enabled && !!nextRunAt && new Date(nextRunAt).getTime() <= now.getTime();
}

export function parseRecipients(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
