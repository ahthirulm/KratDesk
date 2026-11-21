#!/usr/bin/env node
// Build the all-in-one Node package from the connected source without changing its database.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const selfHosted = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(selfHosted);
const output = path.resolve(process.argv[2] || path.join(root, 'dist-selfhost'));
if (output === root || output === path.parse(output).root) throw new Error('Choose a separate build output directory');
const staging = path.join(output, '.build-source');
const version = fs.readFileSync(path.join(root, 'src', 'lib', 'version.ts'), 'utf8').match(/APP_VERSION = '([^']+)'/)?.[1];
if (!version) throw new Error('Could not read APP_VERSION from src/lib/version.ts');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
for (const name of ['src', 'public', 'package.json', 'tsconfig.json', 'bunfig.toml', 'components.json']) {
  fs.cpSync(path.join(root, name), path.join(staging, name), { recursive: true });
}
if (fs.existsSync(path.join(selfHosted, 'public-icons'))) fs.cpSync(path.join(selfHosted, 'public-icons'), path.join(staging, 'public'), { recursive: true });
fs.cpSync(path.join(selfHosted, 'overrides', 'src'), path.join(staging, 'src'), { recursive: true });
fs.copyFileSync(path.join(selfHosted, 'vite.config.ts'), path.join(staging, 'vite.config.ts'));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(staging, 'node_modules'), 'dir');

try {
  execFileSync('bun', ['run', 'build'], {
    cwd: staging,
    stdio: 'inherit',
    env: {
      ...process.env,
      NITRO_PRESET: 'node-server',
      LOVABLE_SANDBOX: '0',
      DEV_SERVER__PROJECT_PATH: '',
      NODE_ENV: 'production',
      SUPABASE_URL: 'http://127.0.0.1:8000',
      SUPABASE_PUBLIC_URL: '/sb',
      SUPABASE_PUBLISHABLE_KEY: 'build-only-publishable-key',
      VITE_SUPABASE_URL: 'http://127.0.0.1:8000',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'build-only-publishable-key',
    },
  });
  const built = path.join(staging, '.output');
  if (!fs.existsSync(built)) throw new Error(`Node build output not found: ${built}`);
  fs.cpSync(built, path.join(output, 'app'), { recursive: true });
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
for (const name of ['start.mjs', 'app.cjs', 'package.json', 'install.sh']) {
  fs.copyFileSync(path.join(selfHosted, name), path.join(output, name));
}
const pkgPath = path.join(output, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.copyFileSync(path.join(selfHosted, 'README.md'), path.join(output, 'README.md'));
const noCaches = (src) => !src.includes('__pycache__') && !src.endsWith('.pyc');
fs.cpSync(path.join(selfHosted, 'deploy'), path.join(output, 'deploy'), { recursive: true, filter: noCaches });
fs.cpSync(path.join(selfHosted, 'backend'), path.join(output, 'backend'), { recursive: true, filter: noCaches });
fs.mkdirSync(path.join(output, 'database', 'migrations'), { recursive: true });
// This schema-comment migration records the isolated Lovable preview, not a Dell upgrade.
const previewOnlyMigrations = new Set(['0078_restore_karatdesk_preview_history.sql']);
for (const file of fs.readdirSync(path.join(root, 'drizzle', 'migrations')).filter((name) => name.endsWith('.sql') && !previewOnlyMigrations.has(name)).sort()) {
  fs.copyFileSync(path.join(root, 'drizzle', 'migrations', file), path.join(output, 'database', 'migrations', file));
}
fs.copyFileSync(path.join(selfHosted, 'database', 'v2-baseline.txt'), path.join(output, 'database', 'v2-baseline.txt'));
fs.chmodSync(path.join(output, 'install.sh'), 0o755);
for (const file of fs.readdirSync(path.join(output, 'deploy'))) {
  if (/\.(sh|py|mjs)$/.test(file)) fs.chmodSync(path.join(output, 'deploy', file), 0o755);
}
const supabaseRef = fs.readFileSync(path.join(selfHosted, 'backend', 'KARATDESK_SUPABASE_REF'), 'utf8').trim();
fs.writeFileSync(path.join(output, 'BUILD-INFO.json'), JSON.stringify({
  app: 'KaratDesk', version, nodeTarget: '22', ubuntuTarget: '24.04 LTS', supabaseRef,
}, null, 2) + '\n');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}
const checksumLines = filesUnder(output).filter((file) => !file.endsWith('CHECKSUMS.sha256')).sort().map((file) => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return `${hash}  ${path.relative(output, file)}`;
});
fs.writeFileSync(path.join(output, 'CHECKSUMS.sha256'), checksumLines.join('\n') + '\n');
console.log(`\nKaratDesk v${version} all-in-one package built at ${output}`);
