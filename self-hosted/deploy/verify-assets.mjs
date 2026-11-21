#!/usr/bin/env node
// Verify runtime configuration and every public JavaScript response byte-for-byte.
import fs from 'node:fs';
import path from 'node:path';

const origin = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const appRoot = process.argv[3] || '/opt/karatdesk/app';
const publicRoot = path.join(appRoot, 'public');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const runtimeResponse = await fetch(`${origin}/api/public/runtime-config`, { cache: 'no-store' });
if (!runtimeResponse.ok) throw new Error(`Runtime configuration returned HTTP ${runtimeResponse.status}`);
const runtime = await runtimeResponse.json();
if (!runtime.supabaseUrl || !runtime.supabasePublishableKey) throw new Error('Runtime configuration is incomplete');
for (const forbidden of ['supabaseServiceRoleKey', 'serviceRoleKey', 'cronSecret', 'LOVABLE_CRON_SECRET']) {
  if (forbidden in runtime) throw new Error(`Runtime configuration exposed ${forbidden}`);
}

const javascript = filesUnder(publicRoot).filter((file) => file.endsWith('.js'));
if (!javascript.length) throw new Error(`No public JavaScript found under ${publicRoot}`);
for (const file of javascript) {
  const relative = path.relative(publicRoot, file).split(path.sep).join('/');
  const response = await fetch(`${origin}/${relative}`);
  if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
  const delivered = Buffer.from(await response.arrayBuffer());
  const disk = fs.readFileSync(file);
  if (!delivered.equals(disk)) {
    throw new Error(`${relative}: delivered ${delivered.length} bytes but disk has ${disk.length} bytes`);
  }
  const declared = Number(response.headers.get('content-length') || delivered.length);
  if (declared !== delivered.length) throw new Error(`${relative}: Content-Length ${declared} != ${delivered.length}`);
  const runtimeFile = path.join(path.dirname(appRoot), '.runtime', 'public', relative);
  if (fs.existsSync(runtimeFile) && !fs.readFileSync(runtimeFile).equals(disk)) {
    throw new Error(`${relative}: runtime copy differs from the packaged file`);
  }
}
console.log(`Runtime configuration is public-safe; ${javascript.length} JavaScript responses match disk byte-for-byte.`);
