// The owner-only factory reset asks for two things before the server is
// contacted: the exact typed wording and the owner's own login password.
export const FACTORY_RESET_PHRASE = 'FACTORY RESET';

export function factoryResetReady(phrase: string, password: string): boolean {
  return phrase.trim().toUpperCase() === FACTORY_RESET_PHRASE && password.length > 0;
}
