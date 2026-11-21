export function displayReference(value: string | null | undefined): string {
  return (value || '').replace(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}-(?=(?:INV|LN|RC)-)/i, '');
}
