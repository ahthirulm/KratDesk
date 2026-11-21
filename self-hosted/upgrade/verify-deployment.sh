#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:?Usage: sudo bash verify-deployment.sh pos.cityjewels.store}"
echo "Version: $(node -p "require('/opt/karatdesk/package.json').version")"
nginx -t
systemctl is-active karatdesk
(cd /opt/karatdesk-backend && docker compose ps)
systemctl is-active cloudflared 2>/dev/null || echo "cloudflared not active (ignore if not using Cloudflare Tunnel)"
docker exec supabase-db psql -U postgres -d postgres -Atc "select version from public.karatdesk_schema_migrations where version >= '0067' order by version"
curl -fsS http://127.0.0.1:3000/api/public/runtime-config; echo
curl -fsS "https://$DOMAIN/api/public/runtime-config"; echo
node /opt/karatdesk/deploy/verify-assets.mjs "https://$DOMAIN" /opt/karatdesk/app
curl -fsS -o /dev/null -w "auth health %{http_code}\n" "https://$DOMAIN/sb/auth/v1/health" -H "apikey: $(grep '^SUPABASE_PUBLISHABLE_KEY=' /opt/karatdesk/.env | cut -d= -f2-)"
ls -lh /var/backups/karatdesk | tail -5
cat <<EOF

Automated checks passed. In the browser at https://$DOMAIN:
1. Sign in as owner; the sidebar shows v2.5.2.
2. Administration > System health shows Dell model, RAM, disk and battery/charger.
3. Open existing stock, sales and a job photo - old records and uploads are there.
4. Users > Add user with no email > Create user; sign in as that user.
5. Download an all-branch backup.
EOF
