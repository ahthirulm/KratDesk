type PublicBackend = { url: string; key: string };

export function runtimeBackend(): PublicBackend | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __KARATDESK_BACKEND__?: PublicBackend }).__KARATDESK_BACKEND__;
}
