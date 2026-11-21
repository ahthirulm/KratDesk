// Fresh installs only: create private backend keys. Upgrades never run this for an existing shop.
import crypto from 'node:crypto';

const random = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const jwtSecret = random(48);
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (role) => {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({ role, iss: 'supabase', iat: now, exp: now + 20 * 365 * 86400 });
  const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const values = {
  JWT_SECRET: jwtSecret,
  ANON_KEY: sign('anon'),
  SERVICE_ROLE_KEY: sign('service_role'),
  POSTGRES_PASSWORD: random(24).replace(/[-_]/g, 'x'),
  DASHBOARD_PASSWORD: random(18).replace(/[-_]/g, 'x'),
  SECRET_KEY_BASE: random(48),
  VAULT_ENC_KEY: random(24).slice(0, 32),
  PG_META_CRYPTO_KEY: random(24).slice(0, 32),
  REALTIME_DB_ENC_KEY: random(16).slice(0, 16),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: random(32),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: random(32),
  S3_PROTOCOL_ACCESS_KEY_ID: crypto.randomBytes(16).toString('hex'),
  S3_PROTOCOL_ACCESS_KEY_SECRET: crypto.randomBytes(32).toString('hex'),
  MINIO_ROOT_PASSWORD: random(32),
  LOVABLE_CRON_SECRET: random(32),
};
for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
