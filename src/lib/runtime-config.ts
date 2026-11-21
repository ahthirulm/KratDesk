export function browserSupabaseUrl(configured: string, origin: string): string {
  const value = configured.trim();
  if (!value || (!value.startsWith('/') && !/^https?:\/\//i.test(value))) {
    throw new Error('Runtime Supabase URL must be absolute or start with /');
  }
  const url = new URL(value, origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Runtime Supabase URL is not valid');
  }
  return url.toString().replace(/\/+$/, '');
}
