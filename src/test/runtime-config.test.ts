import { describe, expect, it } from 'vitest';
import { browserSupabaseUrl } from '@/lib/runtime-config';

describe('self-hosted browser runtime configuration', () => {
  it('resolves the same-origin /sb gateway against the current shop origin', () => {
    expect(browserSupabaseUrl('/sb', 'https://pos.example.com')).toBe('https://pos.example.com/sb');
  });

  it('accepts an absolute HTTPS backend URL and removes trailing slashes', () => {
    expect(browserSupabaseUrl('https://api.example.com/sb/', 'https://pos.example.com')).toBe('https://api.example.com/sb');
  });

  it('rejects non-HTTP and credential-bearing URLs', () => {
    expect(() => browserSupabaseUrl('file:///tmp/config', 'https://pos.example.com')).toThrow();
    expect(() => browserSupabaseUrl('https://user:secret@example.com', 'https://pos.example.com')).toThrow();
  });
});
