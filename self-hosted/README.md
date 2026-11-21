# KaratDesk v2.5.0 — all-in-one self-hosted server

KaratDesk, PostgreSQL, staff authentication, private file storage, and the self-hosted Supabase API run on your Ubuntu VPS. No Supabase Cloud account, Lovable account, or outside database is required.

This package supports fresh installations and in-place upgrades from the KaratDesk all-in-one v2 ZIP.

## What changed in v2.5

- Account recovery: staff can sign in with a verified email or username and reset a forgotten password through a single-use emailed link.
- Staff invitations can be emailed, and password recovery requires a verified contact plus optional authenticator confirmation.
- Optional automatic daily gold-reference rates, with Colombo-date history and manual rates always preserved unless applied.
- Stock system-tag preview, editing and barcode-label support; job-type and job-photo access is restricted to authorised staff.
- Collapsible Settings and Administration groups, a compact sidebar that fits the browser height, and a reorganised Branch account screen.

## What changed in v2.1

- The browser reads `/api/public/runtime-config` before initializing Supabase. The launcher no longer rewrites compiled, hashed JavaScript files.
- The existing `/opt/karatdesk/.runtime/public/assets/` Nginx asset path is retained for v2 compatibility.
- Nginx exposes only Auth, REST, and Storage beneath `/sb/`. Studio and unrelated gateway routes are not public.
- The backend is an immutable Supabase server snapshot at commit `cf556ebd2a26ae6180f054a8ccfd85a183d60b34` (Envoy gateway). The Compose updater also understands older Kong-based v2 installations.
- PostgreSQL migrations are applied once and recorded. An existing v2 database is baselined instead of rerunning its original schema.
- Existing records, uploaded files, API keys, passwords, app environment settings, and scheduled email-backup settings are retained during upgrades.
- A pre-upgrade backup and nightly SQL/uploaded-file backups are included.

## Requirements

- Ubuntu **24.04 LTS** on AWS EC2, Lightsail, DigitalOcean, Hetzner, or another VPS
- At least **2 vCPU, 4 GB RAM, and 30 GB disk**
- Root access through `sudo`
- A domain or subdomain with an **A record pointing to the server**
- Inbound ports **22, 80, and 443** only; do not open PostgreSQL, Supabase, Studio, or the app port publicly

Ordinary cPanel shared hosting cannot run this stack because it does not provide Docker and full PostgreSQL. A cPanel/WHM VPS with root access can use this installer.

## Fresh install

```bash
scp karatdesk-allinone-v2.5.zip ubuntu@YOUR_SERVER_IP:~
ssh ubuntu@YOUR_SERVER_IP
unzip karatdesk-allinone-v2.5.zip
cd karatdesk-allinone-v2.5
sudo bash install.sh pos.example.com you@example.com
```

Replace the domain and certificate email with your own. The email is validated before any packages are installed.

After installation:

1. Open `https://pos.example.com`.
2. Create the first owner (Super Admin).
3. Complete Shop setup.
4. Create staff in **Staff & permissions**, then test a staff sign-in.
5. Run the verification checklist below.

If certificate issuance fails, the installer says **HTTPS setup is incomplete** and prints the exact retry command:

```bash
sudo certbot --nginx -d pos.example.com -m you@example.com --agree-tos -n --redirect
```

Fix DNS or firewall access first, then run that command. Nginx is always tested before it is reloaded.

## Upgrade from all-in-one v2

Use the same domain already installed on the server. Unzip into a new directory; do not overwrite your only copy of the old package.

```bash
scp karatdesk-allinone-v2.5.zip ubuntu@YOUR_SERVER_IP:~
ssh ubuntu@YOUR_SERVER_IP
unzip karatdesk-allinone-v2.5.zip
cd karatdesk-allinone-v2.5
sudo bash install.sh pos.example.com you@example.com
```

The upgrade automatically:

1. Starts the existing backend if needed and takes a database/uploaded-file backup.
2. Saves the existing backend environment, keys, and Compose file beneath `/root/karatdesk-install-backups/`.
3. Installs the pinned backend configuration without deleting or recreating data volumes.
4. Records the v2 migration baseline and applies only migrations that have not run.
5. Replaces the app code while preserving `/opt/karatdesk/.env`.
6. Updates only KaratDesk's Nginx location blocks, preserving Certbot certificates, redirect rules, and unrelated settings.
7. Tests runtime configuration and every public JavaScript response byte-for-byte.

Do **not** run `docker compose down -v`, the upstream `reset.sh`, or delete `/opt/karatdesk-backend/volumes`. Those actions can destroy shop data.

If a migration fails, its filename and the PostgreSQL error are printed. It is not marked as applied, and later migrations are not attempted. Correct the cause and rerun the same upgrade command.

## Runtime configuration and assets

The only public configuration response is:

```text
GET /api/public/runtime-config
```

It contains the public Supabase URL and publishable key. For the all-in-one installation the URL is the same-origin `/sb` path. The service-role key and `LOVABLE_CRON_SECRET` remain server-side.

`start.mjs` loads `.env` and copies `app/` to `.runtime/` without editing any file. Existing v2 Nginx rules pointing at `.runtime/public/assets/` therefore continue to work. There are no placeholder substitutions in browser bundles.

## Network layout

- Public HTTPS: Nginx on 443
- Public HTTP for certificate/redirect: Nginx on 80
- KaratDesk Node server: `127.0.0.1:3000`
- Supabase Envoy/API gateway: `127.0.0.1:8000`
- PostgreSQL and pooler: Docker network only, with host port mappings removed
- Supabase Studio: not exposed through Nginx

Public backend routes are limited to:

```text
/sb/auth/v1/*
/sb/rest/v1/*
/sb/storage/v1/*
```

## Backups

### Automatic local backups

The nightly timer runs `/opt/karatdesk/deploy/backup-now.sh` and retains 14 days:

```text
/var/backups/karatdesk/db-YYYY-MM-DD.sql.gz
/var/backups/karatdesk/files-YYYY-MM-DD.tar.gz
```

Run one manually with:

```bash
sudo bash /opt/karatdesk/deploy/backup-now.sh
```

The SQL dump covers the full PostgreSQL database: shop records, Auth users, settings, storage metadata, audit records, and scheduled email-backup configuration. It does **not** contain uploaded photo/file bytes.

The separate `files-*.tar.gz` archive contains `/opt/karatdesk-backend/volumes/storage`, including uploaded private files. Keep both archive types together and copy them off the VPS. Local backups do not protect against server or disk loss.

The in-app **Administration → Backup** JSON export is a separate application-level backup. Scheduled email backups continue to use their existing settings after an upgrade.

### Restore a full server backup

Test disaster recovery on a disposable server before relying on it. Stop the app during restoration:

```bash
sudo systemctl stop karatdesk
gunzip -c /var/backups/karatdesk/db-2026-11-20.sql.gz | sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Restore the matching uploaded-file archive:

```bash
sudo mv /opt/karatdesk-backend/volumes/storage /opt/karatdesk-backend/volumes/storage.before-restore
sudo tar -xzf /var/backups/karatdesk/files-2026-11-20.tar.gz -C /opt/karatdesk-backend
sudo docker restart supabase-storage
sudo systemctl start karatdesk
```

Use the same date for SQL and files. Confirm owner/staff sign-in, records, and private downloads before deleting `storage.before-restore`.

## Verify a deployment

```bash
sudo bash /opt/karatdesk/deploy/verify-deployment.sh pos.example.com
```

Automated checks cover Nginx syntax, container status, Auth reachability, public-safe runtime configuration, and byte-for-byte JavaScript delivery over HTTPS.

Complete these browser checks as well:

- Fresh install: first-run owner creation and Shop setup
- Staff creation and staff sign-in
- Private job-photo upload and download in a fresh session
- A role without permission cannot read the private file
- Application backup download and restore on a disposable installation
- Upgrade: pre-existing records and uploaded files remain accessible
- Upgrade: the original HTTPS certificate and redirect still work

## Everyday commands

```bash
sudo systemctl restart karatdesk
sudo journalctl -u karatdesk -f
cd /opt/karatdesk-backend && sudo docker compose ps
sudo nginx -t
```

## Build this package from the updated source

From the source project root:

```bash
bun install
node self-hosted/build.mjs /tmp/karatdesk-allinone-v2.5
```

The build uses the self-hosted client overlay and Node server target. It does not apply migrations to the connected development database. ZIP the resulting directory for deployment.

## Moving from hosted KaratDesk

In the current app, use **Administration → Backup** and select all branches. On the new server, create the owner and use **Administration → Restore**. Recreate staff logins in **Staff & permissions**. Use the SQL/file archives above for full server-to-server disaster recovery, including Auth users and uploaded files.

Support: Scopule (Pvt) Ltd — https://www.scopule.com

## Host hardware readings (System health)

Add `KD_SELF_HOSTED=1` to `/opt/karatdesk/.env` on the Dell (or any Linux) host, then restart KaratDesk. Super Admin → Administration → System health will then show the hardware model, battery level/state, charger status, RAM (from MemAvailable) and storage free on the app-data filesystem. Optionally set `KD_DATA_DIR=/opt/karatdesk` to choose which filesystem is measured. Missing readings show "Unavailable"; hosts without a battery show "No battery detected".
