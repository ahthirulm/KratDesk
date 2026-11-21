import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), createClient: vi.fn(), contact: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ not: () => ({ maybeSingle: mocks.contact }) }) }) }) },
}));
import { verifyStaffPassword } from '@/lib/verify-credential';
import { forwardAuthToken } from '@/lib/password-gateway.server';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); delete (window as Window & { __KARATDESK_BACKEND__?: unknown }).__KARATDESK_BACKEND__; });

it('uses same-origin runtime configuration rather than an older localhost bootstrap for password confirmation', async () => {
  (window as Window & { __KARATDESK_BACKEND__?: unknown }).__KARATDESK_BACKEND__ = { url: 'http://127.0.0.1:8000', key: 'old-public-key' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ supabaseUrl: '/sb', supabasePublishableKey: 'current-public-key' })));
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({ auth: { signInWithPassword: mocks.signIn } });
  expect(await verifyStaffPassword('owner@app.local', 'Counter1234')).toBe(true);
  expect(mocks.createClient).toHaveBeenCalledWith(`${window.location.origin}/sb`, 'current-public-key', expect.any(Object));
});

it('allows an existing real-email account to reach password authentication without an invitation mapping', async () => {
  mocks.contact.mockResolvedValue({ data: null, error: null });
  const upstream = vi.fn().mockResolvedValue(Response.json({ access_token: 'dummy-test-token' }));
  vi.stubGlobal('fetch', upstream);
  const response = await forwardAuthToken(new Request('https://pos.example.invalid/sb/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { 'x-karatdesk-client-ip': '192.0.2.80', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'legacy@example.invalid', password: 'Counter1234' }),
  }));
  expect(response.status).toBe(200);
  expect(upstream).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ body: JSON.stringify({ email: 'legacy@example.invalid', password: 'Counter1234' }) }));
});