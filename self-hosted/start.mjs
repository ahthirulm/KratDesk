// KaratDesk self-hosted launcher. Files are copied byte-for-byte; compiled assets are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing settings in .env: ${missing.join(', ')}`);
  process.exit(1);
}
process.env.SUPABASE_PUBLIC_URL ||= '/sb';
process.env.PORT ||= '3000';
process.env.HOST ||= '127.0.0.1';

const source = path.join(root, 'app');
const runtime = path.join(root, '.runtime');
fs.rmSync(runtime, { recursive: true, force: true });
fs.cpSync(source, runtime, { recursive: true });

console.log(`KaratDesk starting on ${process.env.HOST}:${process.env.PORT}`);
await import(pathToFileURL(path.join(runtime, 'server', 'index.mjs')).href);
