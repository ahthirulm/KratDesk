#!/usr/bin/env bash
# KaratDesk v2.5 all-in-one installer for Ubuntu 24.04 LTS and safe v2 upgrades.
set -euo pipefail
DOMAIN="${1:-}"
EMAIL="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/karatdesk
BK=/opt/karatdesk-backend
NGINX_SITE=/etc/nginx/sites-available/karatdesk
NGINX_SNIPPET=/etc/nginx/snippets/karatdesk-locations.conf

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo bash install.sh pos.example.com you@example.com" >&2; exit 1; fi
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || [[ "$DOMAIN" != *.* ]]; then
  echo "Enter a valid domain, for example pos.example.com" >&2; exit 1
fi
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Enter a valid certificate email, for example you@example.com" >&2; exit 1
fi
DOMAIN="${DOMAIN,,}"
UPGRADE=0
[ -d "$BK" ] && UPGRADE=1

echo "==> Installing system packages"
apt-get update -y
apt-get install -y ca-certificates curl nginx certbot python3-certbot-nginx unzip python3
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if [ "$UPGRADE" -eq 1 ]; then
  echo "==> Preserving the existing v2 shop before upgrading"
  (cd "$BK" && docker compose up -d)
  for _ in $(seq 1 90); do docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 5; done
  docker exec supabase-db pg_isready -U postgres >/dev/null
  bash "$HERE/deploy/backup-now.sh"
fi

echo "==> Installing the pinned self-hosted backend"
if [ "$UPGRADE" -eq 0 ]; then
  mkdir -p "$BK"
  cp -a "$HERE/backend/." "$BK/"
  cp "$BK/.env.example" "$BK/.env"
  node "$HERE/deploy/make-keys.mjs" > "$BK/keys.env"
else
  STAMP="$(date +%Y%m%d-%H%M%S)"
  SAFE=/root/karatdesk-install-backups/$STAMP
  mkdir -p "$SAFE"
  cp -a "$BK/.env" "$BK/docker-compose.yml" "$SAFE/"
  [ ! -f "$BK/keys.env" ] || cp -a "$BK/keys.env" "$SAFE/"
  cp -a "$HERE/backend/." "$BK/"
  [ -f "$BK/.env" ] || cp "$BK/.env.example" "$BK/.env"
fi
chmod 600 "$BK/.env" "$BK/keys.env" 2>/dev/null || true

setv() { if grep -q "^$1=" "$BK/.env"; then sed -i "s|^$1=.*|$1=$2|" "$BK/.env"; else echo "$1=$2" >> "$BK/.env"; fi; }
ensurev() { grep -q "^$1=" "$BK/.env" || echo "$1=$2" >> "$BK/.env"; }
while IFS='=' read -r key value; do
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
  ensurev "$key" "$value"
done < "$HERE/backend/.env.example"

if [ ! -f "$BK/keys.env" ]; then
  echo "keys.env is missing; retaining the existing credentials from .env"
  set -a; . "$BK/.env"; set +a
  : > "$BK/keys.env"
  for key in JWT_SECRET ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD DASHBOARD_PASSWORD SECRET_KEY_BASE VAULT_ENC_KEY PG_META_CRYPTO_KEY LOVABLE_CRON_SECRET; do
    if [ -z "${!key:-}" ]; then echo "Required existing credential $key is missing; refusing to generate replacement keys" >&2; exit 1; fi
    echo "$key=${!key}" >> "$BK/keys.env"
  done
  chmod 600 "$BK/keys.env"
fi
set -a; . "$BK/keys.env"; set +a
for key in JWT_SECRET ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD DASHBOARD_PASSWORD SECRET_KEY_BASE VAULT_ENC_KEY PG_META_CRYPTO_KEY REALTIME_DB_ENC_KEY LOGFLARE_PUBLIC_ACCESS_TOKEN LOGFLARE_PRIVATE_ACCESS_TOKEN S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET MINIO_ROOT_PASSWORD; do
  [ -n "${!key:-}" ] || continue
  if [ "$UPGRADE" -eq 0 ]; then setv "$key" "${!key}"; else ensurev "$key" "${!key}"; fi
done
setv DASHBOARD_USERNAME admin
setv SITE_URL "https://$DOMAIN"
setv API_EXTERNAL_URL "https://$DOMAIN/sb/auth/v1"
setv SUPABASE_PUBLIC_URL "https://$DOMAIN/sb"
setv DISABLE_SIGNUP true
setv ENABLE_EMAIL_SIGNUP true
setv ENABLE_EMAIL_AUTOCONFIRM true
setv ENABLE_ANONYMOUS_USERS false
setv ENABLE_PHONE_SIGNUP false
setv ENABLE_PHONE_AUTOCONFIRM false
setv API_GW_HTTP_PORT 8000
setv KONG_HTTP_PORT 8000
python3 "$HERE/deploy/configure-compose.py" "$BK/docker-compose.yml"

(cd "$BK" && docker compose pull && docker compose up -d)
echo "==> Waiting for PostgreSQL"
for _ in $(seq 1 90); do docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 5; done
if ! docker exec supabase-db pg_isready -U postgres >/dev/null; then
  (cd "$BK" && docker compose ps) >&2
  echo "PostgreSQL did not become ready; no KaratDesk migration was attempted." >&2
  exit 1
fi
python3 "$HERE/deploy/migrate.py" "$BK" "$HERE/database/migrations"
docker restart supabase-rest >/dev/null

echo "==> Installing KaratDesk without modifying its compiled assets"
id karatdesk >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin karatdesk
mkdir -p "$APP"
systemctl stop karatdesk 2>/dev/null || true
rm -rf "$APP/app" "$APP/.runtime"
cp -a "$HERE/app" "$HERE/start.mjs" "$HERE/app.cjs" "$HERE/package.json" "$APP/"
mkdir -p "$APP/deploy"
cp -a "$HERE/deploy/." "$APP/deploy/"
chmod +x "$APP/deploy/"*.sh "$APP/deploy/"*.py "$APP/deploy/"*.mjs
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<ENV
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLIC_URL=/sb
SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
LOVABLE_CRON_SECRET=$LOVABLE_CRON_SECRET
PORT=3000
HOST=127.0.0.1
ENV
fi
ensure_app() { grep -q "^$1=" "$APP/.env" || echo "$1=$2" >> "$APP/.env"; }
ensure_app SUPABASE_PUBLIC_URL /sb
ensure_app SUPABASE_PUBLISHABLE_KEY "$ANON_KEY"
ensure_app SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
ensure_app LOVABLE_CRON_SECRET "$LOVABLE_CRON_SECRET"
ensure_app PORT 3000
ensure_app HOST 127.0.0.1
chmod 600 "$APP/.env" "$BK/.env" "$BK/keys.env"
chown -R karatdesk:karatdesk "$APP"
cp "$HERE/deploy/karatdesk.service" /etc/systemd/system/karatdesk.service
systemctl daemon-reload
systemctl enable karatdesk >/dev/null
systemctl start karatdesk

echo "==> Configuring Nginx while preserving existing HTTPS settings"
mkdir -p /etc/nginx/snippets /root/karatdesk-install-backups
NGINX_SAFE="/root/karatdesk-install-backups/nginx-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$NGINX_SAFE"
[ ! -f "$NGINX_SITE" ] || cp -a "$NGINX_SITE" "$NGINX_SAFE/site.conf"
[ ! -f "$NGINX_SNIPPET" ] || cp -a "$NGINX_SNIPPET" "$NGINX_SNIPPET.backup"
if [ ! -f "$NGINX_SITE" ]; then
  sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/deploy/nginx.conf" > "$NGINX_SITE"
fi
cp "$HERE/deploy/nginx-locations.conf" "$NGINX_SNIPPET"
python3 "$HERE/deploy/configure-nginx.py" "$NGINX_SITE" "$DOMAIN"
ln -sf /etc/nginx/sites-available/karatdesk /etc/nginx/sites-enabled/karatdesk
rm -f /etc/nginx/sites-enabled/default
if ! nginx -t; then
  echo "Nginx validation failed; restoring the previous configuration and not reloading it." >&2
  [ ! -f "$NGINX_SAFE/site.conf" ] || cp -a "$NGINX_SAFE/site.conf" "$NGINX_SITE"
  if [ -f "$NGINX_SNIPPET.backup" ]; then mv "$NGINX_SNIPPET.backup" "$NGINX_SNIPPET"; else rm -f "$NGINX_SNIPPET"; fi
  nginx -t || true
  exit 1
fi
rm -f "$NGINX_SNIPPET.backup"
systemctl reload nginx

HTTPS_FAILED=0
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && grep -q "ssl_certificate.*$DOMAIN" "$NGINX_SITE"; then
  echo "Existing Certbot HTTPS certificate and settings preserved."
else
  RETRY="sudo certbot --nginx -d $DOMAIN -m $EMAIL --agree-tos -n --redirect"
  if ! certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos -n --redirect; then
    HTTPS_FAILED=1
    echo "HTTPS setup is incomplete. Your HTTP site and shop data are still present." >&2
    echo "Retry certificate issuance with exactly: $RETRY" >&2
  else
    nginx -t
    systemctl reload nginx
  fi
fi

echo "==> Installing backup timers"
cat > /etc/cron.d/karatdesk <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 * * * * root curl -fsS --max-time 120 -X POST -H "Authorization: Bearer $LOVABLE_CRON_SECRET" -H "Content-Type: application/json" -d '{"kind":"check"}' http://127.0.0.1:3000/api/public/jobs/scheduled-backup >/dev/null 2>&1 || true
30 21 * * * root flock -n /tmp/karatdesk-nightly.lock bash $APP/deploy/backup-now.sh >/dev/null 2>&1 || true
CRON
chmod 600 /etc/cron.d/karatdesk

for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/api/public/runtime-config >/dev/null 2>&1 && break; sleep 2; done
node "$APP/deploy/verify-assets.mjs" http://127.0.0.1:3000 "$APP/app"

if [ "$HTTPS_FAILED" -eq 1 ]; then
  echo "Installation finished, but HTTPS is incomplete. Run the retry command above after fixing DNS or firewall access." >&2
  exit 1
fi
node "$APP/deploy/verify-assets.mjs" "https://$DOMAIN" "$APP/app"
echo
if [ "$UPGRADE" -eq 1 ]; then
  echo "UPGRADE COMPLETE. Existing records, uploaded files, credentials and backup settings were preserved."
else
  echo "INSTALL COMPLETE. Open https://$DOMAIN and create the owner (Super Admin)."
fi
echo "Run the full server checklist: sudo bash $APP/deploy/verify-deployment.sh $DOMAIN"
