# KaratDesk v2.5.2 — in-place upgrade (Dell / Ubuntu, Cloudflare Tunnel)

Upgrades an existing KaratDesk server. Records, uploads, keys, Nginx HTTPS listener and Cloudflare Tunnel are kept.

## Command
```bash
scp karatdesk-dell-v2.5.2-upgrade.zip USER@DELL:~
ssh USER@DELL
unzip -o karatdesk-dell-v2.5.2-upgrade.zip -d karatdesk-dell-v2.5.2
cd karatdesk-dell-v2.5.2
sudo bash install.sh --tunnel pos.cityjewels.store
```
Email is optional; Certbot is skipped in tunnel mode.

## What it does
1. Saves app/backend env, keys, compose, Nginx and /etc/cloudflared to /root/karatdesk-install-backups/upgrade-2.5.2-*.
2. Backs up database + uploaded files to /var/backups/karatdesk/pre-upgrade-2.5.2-* (stops if empty).
3. Applies only pending migrations, 0067–0074 in order, each in its own transaction.
4. Installs compiled app; keeps previous at /opt/karatdesk/app.previous; auto-rollback if it doesn't start.
5. Sets KD_SELF_HOSTED=1 (Dell System health), SUPABASE_URL=http://127.0.0.1:8000, SUPABASE_PUBLIC_URL=/sb.
6. Replaces only KaratDesk location blocks in Nginx; tests before reload, restores on failure.

## Verify
```bash
sudo bash /opt/karatdesk/deploy/verify-deployment.sh pos.cityjewels.store
```

## Roll back
```bash
sudo systemctl stop karatdesk
sudo rm -rf /opt/karatdesk/app /opt/karatdesk/.runtime && sudo mv /opt/karatdesk/app.previous /opt/karatdesk/app
sudo systemctl start karatdesk
# database (only if needed):
gunzip -c /var/backups/karatdesk/pre-upgrade-2.5.2-*/db.sql.gz | sudo docker exec -i supabase-db psql -U postgres -d postgres
```
