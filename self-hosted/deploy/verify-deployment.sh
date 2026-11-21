#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:?Usage: sudo bash verify-deployment.sh pos.example.com}"
nginx -t
(cd /opt/karatdesk-backend && docker compose ps)
node /opt/karatdesk/deploy/verify-assets.mjs "https://$DOMAIN" /opt/karatdesk/app
curl -fsS "https://$DOMAIN/sb/auth/v1/health" >/dev/null
cat <<EOF

Automated server checks passed. Complete these shop checks in a browser:
1. Fresh install only: create the first owner, then create and sign in a staff user.
2. Upload a private job photo as that staff member; download it in a new browser session.
3. Confirm another staff role without permission cannot read that private file.
4. Download an all-branch application backup; test Restore on a disposable installation.
5. Confirm nightly SQL and uploaded-file archives exist in /var/backups/karatdesk.
6. Upgrade check: open pre-existing records and uploaded files, and confirm existing HTTPS still works.
EOF
