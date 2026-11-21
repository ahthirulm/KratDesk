export const DEFAULT_INACTIVITY_MINUTES = 60;
export const INACTIVITY_OPTIONS = [15, 30, 60, 120, 240, 480] as const;

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('Use 3–32 letters, numbers, dots, dashes or underscores for the username');
  }
  return username;
}

export function internalLoginEmail(username: string) {
  return `${normalizeUsername(username)}@app.local`;
}

export function validatePassword(password: string) {
  if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Use 10–72 characters with at least one letter and one number');
  }
  return password;
}

export function validateInactivityMinutes(value: number) {
  if (!Number.isInteger(value) || value < 5 || value > 480) {
    throw new Error('Choose an inactivity timeout between 5 and 480 minutes');
  }
  return value;
}

export function remainingInactivityMs(lastActivity: number, now: number, minutes = DEFAULT_INACTIVITY_MINUTES) {
  return Math.max(0, lastActivity + validateInactivityMinutes(minutes) * 60_000 - now);
}
