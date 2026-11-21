#!/usr/bin/env bash
# KaratDesk v2.5.2 in-place upgrade for an existing Ubuntu (Dell) KaratDesk server.
# Usage:
#   sudo bash install.sh --tunnel pos.cityjewels.store              (Cloudflare Tunnel: Certbot skipped)
#   sudo bash install.sh pos.cityjewels.store you@example.com       (direct HTTPS: Certbot only if no certificate exists)
set -euo pipefail
TUNNEL=0; ARGS=()
for a in "$@"; do case "$a" in --tunnel) TUNNEL=1;; *) ARGS+=("$a");; esac; done
DOMAIN="${ARGS[0]:-}"; EMAIL="${ARGS[1]:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/karatdesk
BK=/opt/karatdesk-backend
NGINX_SITE=/etc/nginx/sites-available/karatdesk
NGINX_SNIPPET=/etc/nginx/snippets/karatdesk-locations.conf
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE=/root/karatdesk-install-backups/upgrade-2.5.2-$STAMP
PRE=/var/backups/karatdesk/pre-upgrade-2.5.2-$STAMP

die() { echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run with sudo: sudo bash install.sh --tunnel pos.cityjewels.store"
[[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ && "$DOMAIN" == *.* ]] || die "Enter a valid domain, e.g. pos.cityjewels.store"
DOMAIN="${DOMAIN,,}"
if [ -n "$EMAIL" ] && [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then die "Certificate email is not valid"; fi
[ -d "$BK" ] && [ -f "$BK/.env" ] || die "$BK/.env not found. This package upgrades an existing KaratDesk server only."
[ -f "$APP/.env" ] || die "$APP/.env not found. This package upgrades an existing KaratDesk server only."
command -v docker >/dev/null || die "Docker is missing"
command -v node >/dev/null && node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)' || die "Node.js 22 or newer is required"
command -v python3 >/dev/null || die "python3 is required"

echo "==> KaratDesk v2.5.2 upgrade for $DOMAIN (tunnel mode: $TUNNEL)"
echo "==> Saving current configuration to $SAFE"
mkdir -p "$SAFE"; chmod 700 /root/karatdesk-install-backups "$SAFE"
cp -a "$APP/.env" "$SAFE/app.env"
cp -a "$BK/.env" "$SAFE/backend.env"
[ ! -f "$BK/keys.env" ] || cp -a "$BK/keys.env" "$SAFE/"
cp -a "$BK/docker-compose.yml" "$SAFE/" 2>/dev/null || true
[ ! -f "$NGINX_SITE" ] || cp -a "$NGINX_SITE" "$SAFE/nginx-site.conf"
[ ! -f "$NGINX_SNIPPET" ] || cp -a "$NGINX_SNIPPET" "$SAFE/nginx-locations.conf"
[ ! -d /etc/cloudflared ] || cp -a /etc/cloudflared "$SAFE/cloudflared"
[ ! -f /etc/cron.d/karatdesk ] || cp -a /etc/cron.d/karatdesk "$SAFE/cron"

echo "==> Making sure the existing backend is running (no containers or volumes are recreated)"
(cd "$BK" && docker compose up -d)
for _ in $(seq 1 90); do docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 5; done
docker exec supabase-db pg_isready -U postgres >/dev/null || die "PostgreSQL is not ready; nothing was changed."

echo "==> Backing up the database and uploaded files to $PRE"
mkdir -p "$PRE"; chmod 700 "$PRE"
docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists --no-owner --no-privileges | gzip > "$PRE/db.sql.gz.tmp"
gzip -t "$PRE/db.sql.gz.tmp" && [ "$(stat -c %s "$PRE/db.sql.gz.tmp")" -gt 1000 ] || die "Database backup looks empty; upgrade stopped before any change."
mv "$PRE/db.sql.gz.tmp" "$PRE/db.sql.gz"
if [ -d "$BK/volumes/storage" ]; then
  tar -czf "$PRE/files.tar.gz" -C "$BK" volumes/storage
  tar -tzf "$PRE/files.tar.gz" >/dev/null || die "Uploaded-file backup failed; upgrade stopped before any change."
fi
echo "    Database: $PRE/db.sql.gz"; [ ! -f "$PRE/files.tar.gz" ] || echo "    Uploads:  $PRE/files.tar.gz"

echo "==> Applying pending database migrations (0067-0074 in order)"
python3 "$HERE/deploy/migrate.py" "$BK" "$HERE/database/migrations" || die "A migration failed and was rolled back. The app was not changed. Backup: $PRE"
docker restart supabase-rest >/dev/null

echo "==> Installing the compiled v2.5.2 app (previous app kept for rollback)"
systemctl stop karatdesk 2>/dev/null || true
rm -rf "$APP/app.previous"; [ ! -d "$APP/app" ] || mv "$APP/app" "$APP/app.previous"
rm -rf "$APP/.runtime"
cp -a "$HERE/app" "$HERE/start.mjs" "$HERE/app.cjs" "$HERE/package.json" "$HERE/BUILD-INFO.json" "$APP/"
mkdir -p "$APP/deploy"; cp -a "$HERE/deploy/." "$APP/deploy/"
chmod +x "$APP/deploy/"*.sh "$APP/deploy/"*.py "$APP/deploy/"*.mjs
setapp() { if grep -q "^$1=" "$APP/.env"; then sed -i "s|^$1=.*|$1=$2|" "$APP/.env"; else echo "$1=$2" >> "$APP/.env"; fi; }
ensure_app() { grep -q "^$1=" "$APP/.env" || echo "$1=$2" >> "$APP/.env"; }
# Server talks to the backend on localhost; browsers use same-origin /sb. Keys stay in this server-only file.
grep -q '^SUPABASE_URL=http://127\.0\.0\.1:8000$\|^SUPABASE_URL=http://localhost:8000$' "$APP/.env" || setapp SUPABASE_URL http://127.0.0.1:8000
setapp SUPABASE_PUBLIC_URL /sb
ensure_app PORT 3000
ensure_app HOST 127.0.0.1
setapp KD_SELF_HOSTED 1
ensure_app KD_DATA_DIR /opt/karatdesk
ensure_app KD_HOST_PROVIDER "Dell server"
for k in SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY; do grep -q "^$k=." "$APP/.env" || die "$k missing from $APP/.env (restore $SAFE/app.env)"; done
chmod 600 "$APP/.env"; chown -R karatdesk:karatdesk "$APP"
cp "$HERE/deploy/karatdesk.service" /etc/systemd/system/karatdesk.service
systemctl daemon-reload; systemctl enable karatdesk >/dev/null; systemctl start karatdesk
ok=0; for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/api/public/runtime-config >/dev/null 2>&1 && ok=1 && break; sleep 2; done
if [ "$ok" -ne 1 ]; then
  echo "New app did not start; rolling the app files back." >&2
  systemctl stop karatdesk || true; rm -rf "$APP/app" "$APP/.runtime"; mv "$APP/app.previous" "$APP/app"
  cp -a "$SAFE/app.env" "$APP/.env"; chown -R karatdesk:karatdesk "$APP"; systemctl start karatdesk || true
  die "App start failed. See: journalctl -u karatdesk -n 100. Database migrations remain applied; backup at $PRE"
fi
node "$APP/deploy/verify-assets.mjs" http://127.0.0.1:3000 "$APP/app"

echo "==> Updating only KaratDesk location blocks in Nginx (HTTPS listener, certificates and server settings kept)"
mkdir -p /etc/nginx/snippets
cp "$HERE/deploy/nginx-locations.conf" "$NGINX_SNIPPET"
if [ -f "$NGINX_SITE" ]; then python3 "$HERE/deploy/configure-nginx.py" "$NGINX_SITE" "$DOMAIN"; else echo "    $NGINX_SITE not found; Nginx site left unchanged."; fi
if ! nginx -t; then
  echo "Nginx test failed; restoring previous Nginx files." >&2
  [ ! -f "$SAFE/nginx-site.conf" ] || cp -a "$SAFE/nginx-site.conf" "$NGINX_SITE"
  if [ -f "$SAFE/nginx-locations.conf" ]; then cp -a "$SAFE/nginx-locations.conf" "$NGINX_SNIPPET"; fi
  nginx -t && systemctl reload nginx
  die "Nginx was restored to its previous working state. The app itself is upgraded."
fi
systemctl reload nginx

if [ "$TUNNEL" -eq 1 ]; then
  echo "==> Tunnel mode: Certbot skipped; Cloudflare Tunnel files and credentials untouched."
  systemctl is-active --quiet cloudflared && echo "    cloudflared is running." || echo "    WARNING: cloudflared service is not active. Check: systemctl status cloudflared" >&2
elif [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "==> Existing certificate kept; Certbot not run."
elif [ -n "$EMAIL" ]; then
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos -n --redirect && nginx -t && systemctl reload nginx || echo "HTTPS certificate request failed; site and data are unchanged." >&2
else
  echo "==> No certificate found and no email given; HTTPS was not changed."
fi

echo "==> Public check through https://$DOMAIN"
if node "$APP/deploy/verify-assets.mjs" "https://$DOMAIN" "$APP/app"; then PUB=ok; else PUB=fail; fi
echo
echo "UPGRADE COMPLETE: KaratDesk $(node -p "require('$APP/package.json').version")"
echo "Pre-upgrade backup: $PRE"
echo "Saved configuration: $SAFE"
[ "$PUB" = ok ] || echo "WARNING: the public https://$DOMAIN check failed; the local app is running. Check the tunnel/Nginx route." >&2
echo "Run the checklist: sudo bash $APP/deploy/verify-deployment.sh $DOMAIN"
