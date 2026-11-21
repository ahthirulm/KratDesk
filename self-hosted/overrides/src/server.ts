import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const localBackend = (globalThis as typeof globalThis & { __KD_BACKEND__?: (request: Request) => Promise<Response> }).__KD_BACKEND__;
      if (localBackend && new URL(request.url).pathname.startsWith('/sb/')) return await localBackend(request);
      if (request.method === "GET" && new URL(request.url).pathname === "/karatdesk-config.js" && process.env["KD_SELF_HOSTED"] === "1") {
        const url = process.env["KD_PUBLIC_SUPABASE_URL"] || process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Backend configuration unavailable", { status: 503 });
        return new Response(`window.__KARATDESK_BACKEND__ = ${JSON.stringify({ url, key })};`, {
          headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      }
      if (new URL(request.url).pathname === "/sb/auth/v1/token" && process.env["KD_SELF_HOSTED"] === "1") {
        const { forwardAuthToken } = await import("./lib/password-gateway.server");
        return await forwardAuthToken(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      if (process.env['KD_STANDALONE'] === '1') {
        const headers = new Headers(normalized.headers);
        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
        headers.set('x-content-type-options', 'nosniff');
        return new Response(normalized.body, { status: normalized.status, statusText: normalized.statusText, headers });
      }
      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
