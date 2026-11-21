import { defineConfig } from '@lovable.dev/vite-tanstack-config';

export default defineConfig({
  tanstackStart: {
    server: { entry: 'server' },
  },
  vite: {
    // The self-hosted browser client waits for /api/public/runtime-config using
    // top-level await before any Supabase auth guard can run.
    build: { target: 'esnext' },
  },
});
