const windowMs = 5 * 60 * 1000;
const attempts = new Map<string, { failures: number; expires: number; busy: boolean }>();

function waitResponse(seconds: number) {
  return Response.json(
    { error_code: 'over_request_rate_limit', msg: `Too many login attempts. Try again in ${seconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(seconds), 'Cache-Control': 'no-store' } },
  );
}

export async function forwardAuthToken(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const upstream = new URL('/auth/v1/token', 'http://127.0.0.1:8000');
  upstream.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of ['apikey', 'authorization', 'content-type', 'x-client-info', 'x-supabase-api-version']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Nginx overwrites this header with the socket peer address.
  const ip = request.headers.get('x-karatdesk-client-ip');
  if (!ip) return new Response(null, { status: 403 });
  headers.set('x-forwarded-for', ip);
  let body = await request.text();
  const send = async () => {
    const response = await fetch(upstream, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  };
  if (upstream.searchParams.get('grant_type') !== 'password') return send();
  let login: unknown;
  let payload;
  try {
    payload = JSON.parse(body);
    login = payload.email ?? payload.phone;
  } catch {
    return Response.json({ msg: 'Invalid login request' }, { status: 400 });
  }
  if (typeof login !== 'string' || login.length > 320) {
    return Response.json({ msg: 'Invalid login request' }, { status: 400 });
  }

  let loginKey = login.trim().toLowerCase();
  if (typeof payload.email === 'string') {
    const email = payload.email.trim().toLowerCase();
    loginKey = email;
    if (!email.endsWith('@app.local')) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: contact } = await (supabaseAdmin as any)
        .from('kd_account_contacts').select('user_id')
        .eq('email', email).not('verified_at', 'is', null).maybeSingle();
      const account = contact ? await supabaseAdmin.auth.admin.getUserById(contact.user_id) : null;
      const internalEmail = account?.data.user?.email;
      if (internalEmail?.endsWith('@app.local')) {
        loginKey = internalEmail;
        body = JSON.stringify({ ...payload, email: internalEmail });
      }
      // Older installations have real-email auth identities without a contacts
      // mapping. Let Auth validate those credentials; never reject them solely
      // because the newer invitation directory has no matching row.
    }
  }

  const now = Date.now();
  const key = JSON.stringify([ip, loginKey]);
  for (const [entry, state] of attempts) {
    if (state.expires <= now && !state.busy) attempts.delete(entry);
  }
  let state = attempts.get(key);
  if (!state) {
    if (attempts.size >= 20000) return waitResponse(60);
    state = { failures: 0, expires: now + windowMs, busy: false };
    attempts.set(key, state);
  }
  if (state.busy) return waitResponse(1);
  if (state.failures >= 10) return waitResponse(Math.max(1, Math.ceil((state.expires - now) / 1000)));

  state.busy = true;
  try {
    const response = await send();
    if (response.ok) {
      attempts.delete(key);
    } else if ([400, 401].includes(response.status)) {
      state.failures += 1;
      if (state.failures === 10) {
        state.expires = Date.now() + windowMs;
        await response.body?.cancel();
        return waitResponse(300);
      }
    }
    return response;
  } finally {
    state.busy = false;
  }
}
