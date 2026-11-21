import { afterEach, expect, it, vi } from 'vitest';
import { forwardAuthToken } from '../lib/password-gateway.server';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('blocks an IP and username after ten failures and permits retry after five minutes', async () => {
  const start = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
  const fetch = vi.fn(async () => Response.json({ msg: 'Invalid credentials' }, { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  const attempt = (ip = '192.0.2.1', email = 'user@app.local') =>
    forwardAuthToken(new Request('https://pos.example.invalid/sb/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'x-karatdesk-client-ip': ip, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'dummy-password' }),
    }));
  for (let i = 0; i < 9; i++) expect((await attempt()).status).toBe(400);
  expect((await attempt()).headers.get('retry-after')).toBe('300');
  expect((await attempt(undefined, 'USER@app.local')).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(10);
  expect((await attempt('192.0.2.2')).status).toBe(400);
  clock.mockReturnValue(start + 300001);
  expect((await attempt()).status).toBe(400);
});
