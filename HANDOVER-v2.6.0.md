# KaratDesk 2.6.0 — complete source and deployment handover

Prepared 21 November 2026. Owner-approved next release: **2.6.0**.

## Start here

**Source ready:** the full source archive includes the existing POS, self-hosted build kit, original production SQL history, tests, and both requested corrections. The displayed application version is now 2.6.0.

**Dell upgrade ZIP still pending:** the previously shipped `karatdesk-dell-v2.5.3-upgrade.zip` has not been attached in this workspace. Attach that file to finish assembling the safe in-place 2.6.0 release. Do not substitute the original all-in-one installer from the source kit.

**Production has not been upgraded or verified.** Compilation, unit tests and local runtime/asset checks are not proof of a successful Dell upgrade, real password confirmation, or a restore of the owner's 166-record backup.

### Delivered files

| File | Purpose |
|---|---|
| `karatdesk-v2.6.0-source-handover.zip` | Complete source, tests, hosting kit and this guide; one root folder `karatdesk-v2.6.0-source/` |
| `KaratDesk-v2.6.0-Full-Handover.md` | This standalone guide |
| `KaratDesk-v2.6.0-Verification.txt` | Exact checks performed and checks not performed |
| `KaratDesk-v2.6.0-SHA256.txt` | SHA-256 hashes for the three files above |
| `karatdesk-dell-v2.6.0-upgrade.zip` | **Not delivered yet.** Final assembly needs the previous Dell upgrade ZIP |

The source archive deliberately excludes actual environment files, credentials, tunnel configuration, records, private uploads, repository metadata, dependencies, build output and test caches. Safe upstream configuration examples remain examples, not usable production secrets. Managed workspace settings are not transferable source credentials.

## 1. Product and non-negotiable conventions

- Continue **KaratDesk — Jewellery POS & Inventory**; do not replace the application with a new starter.
- Developed by **Scopule (Pvt) Ltd**, https://www.scopule.com.
- Multi-branch jewellery retail in Sri Lanka. Known production branches from the owner handover are City Jewels (B1) and Alishara (B2); confirm current names before modifying production records.
- Preserve teal controls, gold accents, compact POS screens, and neutral light/dark surfaces.
- Currency calculations are LKR. Whole amounts omit `.00`; amounts with cents use two decimals. Whole weights omit `.000`; fractional grams use three decimals. Do not add redundant visible LKR labels to new screens.
- Business dates, rate history, schedules and reports use **Asia/Colombo (UTC+5:30)**.
- Local staff can sign in with a username and password without an invitation or mandatory contact email. Default inactivity logout is one hour. Optional per-user TOTP and verified-email recovery remain supported.
- Permissions must be enforced by the server and database. Never infer authority solely from a displayed role name or editable user metadata.
- Owner/Super Admin: unrestricted operations, password-confirmed reset and backup controls. Administrator: management access without owner-only factory reset or scheduled-backup configuration. Managing Director: all-branch operations/reports and owner cash, not deep settings, staff administration, voids or deletes. Branch staff: assigned-branch access, no branch switcher. Preserve configured templates and exact checks in source.
- Never invent a role called Test. Never run owner setup on the existing Dell. Do not broaden permissions or bypass password/MFA checks to resolve an error.
- Never reset the production backend, delete volumes, replace existing keys, or change the tunnel destination without inspecting the actual local installation.

## 2. What changed for 2.6.0

### A. Email-free staff creation

Reported production error: **“Use an email invitation to create a user login”** when the optional email field was empty.

The old `createStaffAccount` implementation unconditionally rejected local account creation. It now checks the caller's administrator permission before dynamically loading the privileged client and shared `createLocalStaff` helper.

The helper:

1. Normalizes and validates username/password/name.
2. Validates the role and selected active branches with the caller-scoped client.
3. Creates an authentication identity using the internal username-derived `@app.local` identifier. This is not a contact address and needs no email invitation or delivery provider.
4. Assigns role, branches and account status via the caller-scoped `save_staff_access` permission function.
5. Deletes the unused identity if access assignment fails; reports cleanup failure for owner review instead of silently leaving a working unauthorized account.

Principal files: `src/lib/security.functions.ts`, `src/lib/local-staff.server.ts`, `src/lib/security-rules.ts`, `src/test/local-staff.test.ts`.

The helper is shared by Cloud and self-hosted source. The final Dell package must be rebuilt from this source; an old ZIP does not receive the correction automatically.

### B. Restore password confirmation

Reported production error: **“That password is not correct. Try again.”** for the owner's restore confirmation.

Two defects were reproduced and corrected:

- Password verification preferred the stale legacy global configuration over the fresh browser runtime response. It now fetches `/api/public/runtime-config` first with no caching and resolves relative `/sb` addresses against the current page origin. The legacy global is only a fallback.
- The self-hosted password gateway rejected real-email accounts when the newer contact directory had no corresponding row. It now forwards those legacy credentials to upstream authentication for validation. Verified contact mappings to internal local accounts still work. Rate limiting and upstream password validation remain intact.

Principal files: `src/lib/verify-credential.ts`, `src/lib/password-gateway.server.ts`, `src/lib/runtime-config.ts`, `src/test/restore-password.test.ts`.

There is no password bypass and no claim that the owner's production restore already succeeds. Real Dell password confirmation and the 166-record restore remain required checks after deployment.

### C. Version and build kit

- `src/lib/version.ts` is the single source for the visible app version, now **2.6.0**.
- The original complete `self-hosted/` kit is restored to the project and source export.
- All **78 original production migrations (0000–0077)** remain byte-for-byte identical to the supplied v2.5.3 source archive.
- A separate **0078** migration only comments the isolated Lovable preview schema. Complete source retains it; the Node builder deliberately omits it from Dell output. It is not a new production business migration.
- Two build-assembly tests ensure the preview comment is excluded and the original 78 migration files are packaged unchanged.
- The original hosting README and `upgrade/` source files retain historical version labels. Their status is explained in `self-hosted/RELEASE-STATUS.md`. They are not presented as a finished 2.6.0 installer.

## 3. Environments and separation

| Environment | Status |
|---|---|
| Existing production | `https://pos.cityjewels.store`, Dell Ubuntu behind Cloudflare Tunnel and Nginx; no deployment performed in this task |
| Current preview | `https://id-preview--e0e64c32-236b-4f29-9425-7f5d447bfb6d.lovable.app` |
| Current preview data | Separate Lovable Cloud database/auth/storage; existing Dell records, identities and photos have not been imported |
| Lovable published site | Not published by this packaging task |
| Dell target | Node 22+, Ubuntu 24.04 LTS according to the supplied kit; installed OS and capacity need local confirmation |

The previous workspace's connections are not active connections in this workspace. Production and preview must not share credentials or accidentally point at each other's database. No production credentials are included in these files.

## 4. Production network layout and directories

```text
Browser: https://pos.cityjewels.store
                    |
             Cloudflare Tunnel
                    |
              existing Nginx
               /          \
       app / assets       /sb/auth/v1/*
       127.0.0.1:3000      /sb/rest/v1/*
          Node             /sb/storage/v1/*
                               |
                         127.0.0.1:8000
                         local API gateway
                               |
                       database/auth/storage
                         private containers
```

Retain the actual tunnel destination/credentials, Nginx listener, certificate and redirects. Tunnel-mode upgrades skip Certbot; a certificate email is not required for that upgrade mode. Only the app's intended backend API prefixes are public. Studio, database, pooler, app port 3000 and gateway port 8000 remain private.

| Path | Function |
|---|---|
| `/opt/karatdesk/app/` | Compiled server and public files |
| `/opt/karatdesk/start.mjs`, `app.cjs`, `package.json` | Runtime launchers and version manifest |
| `/opt/karatdesk/.runtime/` | Byte-identical runtime copy; compatible public asset directory |
| `/opt/karatdesk/.env` | Existing private app settings, mode 600 |
| `/opt/karatdesk/app.previous/` | Previous app output; inspect compatibility before rollback |
| `/opt/karatdesk/deploy/` | Migration, backup, Nginx and verification tools |
| `/opt/karatdesk-backend/` | Existing local backend |
| `/opt/karatdesk-backend/volumes/storage/` | Private uploaded file bytes |
| `/etc/systemd/system/karatdesk.service` | App service |
| `/etc/nginx/sites-available/karatdesk` | Existing Nginx site |
| `/etc/nginx/snippets/karatdesk-locations.conf` | Managed app/API locations |
| `/etc/cloudflared/` | Private tunnel configuration; do not distribute |
| `/etc/cron.d/karatdesk` | Existing backup/job schedules; verify live contents locally |
| `/var/backups/karatdesk/` | Full SQL/upload archives and pre-upgrade backups |
| `/root/karatdesk-install-backups/` | Protected saved application/backend/Nginx/tunnel configuration |

## 5. Source structure and module map

```text
karatdesk-v2.6.0-source/
  HANDOVER-v2.6.0.md
  VERIFICATION-v2.6.0.txt
  SOURCE-CHECKSUMS.sha256
  AGENTS.md, roadmap.md
  package.json, bun.lock, bunfig.toml
  vite.config.ts, tsconfig.json, vitest.config.ts
  src/
    router.tsx, start.ts, server.ts
    routeTree.gen.ts              generated; do not hand-edit
    styles.css                   semantic design tokens
    routes/                      TanStack content and HTTP routes
    components/pos/              POS screens and shared state
    components/ui/               existing design-system controls
    integrations/                client, auth middleware and types
    lib/                         business rules and server functions
    test/                        49 application test suites
  public/                        manifest, service worker and assets
  drizzle/
    schema.ts
    migrations/                  0000–0078, plus journal/snapshots
  self-hosted/
    RELEASE-STATUS.md
    build.mjs, vite.config.ts
    start.mjs, app.cjs, package.json
    install.sh, README.md         original all-in-one kit
    overrides/src/               Node/browser-only build overlays
    public-icons/                local PWA icons and manifest
    database/v2-baseline.txt
    deploy/                      migration/backup/Nginx/service tools
    backend/                     pinned local backend templates
    tests/                       hosting and assembly checks
    upgrade/                     original in-place source baseline
```

Workspace-specific `.env` and managed backend configuration are excluded. Their exclusion does not remove application source; reconnect a future Cloud workspace through its normal setup rather than copying old environment values. The Dell uses its existing private runtime settings and self-hosted overlays.

| Area | Principal files |
|---|---|
| Login / owner startup | `components/pos/auth.tsx`, `startup.tsx`, `lib/security.functions.ts` |
| Session / navigation / shared data | `shell.tsx`, `data.tsx`, `session-security.tsx`, `src/start.ts` |
| Billing / payments / receipts | `billing.tsx`, `receipt-header.tsx`, `lib/sale-lifecycle.ts`, `pos-rules.ts` |
| Stock / tags / counts / import | `stock.tsx`, `stock-check.tsx`, `lib/stock-*` |
| Customers / suppliers | `customers.tsx`, `suppliers.tsx`, `lib/customer-*` |
| Repairs / jobs / loans | `repairs.tsx`, `loans.tsx`, `lib/repairs.ts`, `loan-terms.ts` |
| Branch / owner cash / expenses | `branch-account.tsx`, `owner-cash.tsx`, `lib/petty-cash.ts`, `expense-payees.ts` |
| Old gold / currency / cheques | `old-gold.tsx`, `currency-exchange.tsx`, `cheques.tsx` and matching libraries |
| Users / role assignment | `users.tsx`, `lib/security.functions.ts`, `local-staff.server.ts`, SQL permission functions |
| Password/email recovery | `lib/accounts.functions.ts`, `security-rules.ts`, runtime and gateway helpers |
| Atomic restore / factory reset | `central.tsx`, `lib/restore.functions.ts`, `restore-plan.ts`, `factory-reset.ts` |
| Backups / schedules / email | `lib/backup*`, `scheduled-backup.server.ts` |
| Reports / exports | `reports.tsx`, `report-hub.tsx`, `import-export.tsx`, spreadsheet/report libraries |
| System health | `system-health.tsx`, `lib/host-health.functions.ts`, Linux-only overlay |

Keep TanStack routing and the existing package pins. Do not introduce another router or a page-switching `App.tsx`. Ordinary application logic uses authenticated server functions; public HTTP handlers validate their own caller. Keep Node/Linux imports inside self-host overlays and out of the Cloud runtime.

## 6. Dependency pins and reproducible builds

Use the included lockfile. Declared caret ranges are not a new audit of every resolved dependency.

| Item | Manifest / target |
|---|---|
| Node | 22 or newer for the self-host runtime |
| Package manager | Bun; `bun install --frozen-lockfile` |
| React / React DOM | `^19.2.0` |
| TanStack Start | `1.168.60` |
| TanStack Router | `1.170.41` |
| Router plugin | `1.168.42` |
| Vite | `8.1.5` |
| Nitro | `3.0.260603-beta`; Dell uses the Node server preset |
| Tailwind | `^4.2.1` |
| Zod | `4.6.6` |
| Vitest | `^4.1.10` |
| Spreadsheet package | SheetJS 0.20.3 CDN tarball in the lockfile |
| Barcode / charts | `jsbarcode ^3.12.3`, `recharts ^2.15.4` |

### Build on a separate machine or temporary directory

Do not compile over the production app directory.

```bash
unzip karatdesk-v2.6.0-source-handover.zip -d .
cd karatdesk-v2.6.0-source
sha256sum -c SOURCE-CHECKSUMS.sha256
bun install --frozen-lockfile
bunx vitest run
PYTHONDONTWRITEBYTECODE=1 python3 self-hosted/tests/test_deploy.py
PYTHONDONTWRITEBYTECODE=1 python3 self-hosted/tests/test_release_build.py
```

Compile with inherited hosted/backend credentials removed:

```bash
python3 - <<'PY'
import os, subprocess
env = {
    key: value for key, value in os.environ.items()
    if not key.startswith(('VITE_SUPABASE_', 'SUPABASE_', 'LOVABLE_'))
}
subprocess.run(
    ['node', 'self-hosted/build.mjs', '/tmp/karatdesk-v2.6.0-node-output'],
    env=env, check=True,
)
PY
```

The chosen output directory is deleted by the builder. It must be a disposable build-output directory, not the project root, `/opt/karatdesk`, a backup folder or a valuable existing folder.

The builder stages source, applies runtime/browser/Linux overlays, uses build-only public placeholders, compiles Node output, copies local PWA icons, and packages 78 production migrations. Real credentials are loaded at runtime. Its original all-in-one installer is **not** the ready-to-use Dell upgrade entry point.

The connected Cloud build is not the Dell artifact. Do not deploy an ordinary browser-only `dist/` folder or the Cloud server bundle on this Node installation.

## 7. Final Dell ZIP assembly — pending the prior ZIP

Required input: the actual previously shipped Dell upgrade ZIP, normally `karatdesk-dell-v2.5.3-upgrade.zip` from the owner's handover.

The owner-approved final naming is:

- Archive: `karatdesk-dell-v2.6.0-upgrade.zip`
- Exactly one archive root folder: `karatdesk-dell-v2.6.0/`
- Runtime, compiled sidebar version and build information: **2.6.0**.

### Preserve and compare, rather than recreate

1. Inspect the previous ZIP safely and extract into an isolated staging directory. Exclude all repository metadata. Reject unsafe paths/symlinks or archives containing actual credentials.
2. Retain its in-place installer, backend assets, launchers, Nginx rules, existing one-folder layout and deployment scripts as the baseline.
3. Compare every previously shipped SQL file with the matching source file. Stop if an old migration differs; never overwrite a mismatch silently.
4. Replace only the compiled `app/` with the newly built 2.6.0 Node output. Bring across required launcher/server changes deliberately.
5. Add source migrations 0076 and 0077 if they were not shipped previously. Retain 0000–0075 byte-identically. Omit the preview-only 0078 schema comment from Dell output.
6. Preserve the previously shipped **60 MB maximum restore body** and **300-second restore proxy timeout** settings. The source kit's older Nginx snippet does not contain those settings; it must not overwrite the previous release's corrected snippet.
7. Verify the password gateway's exact auth-token routing and trusted client-IP header from the previous Nginx baseline. The gateway requires Nginx's socket-peer header; bypassing it or trusting a browser-supplied value is unsafe.
8. Update installer/README/UPGRADE/verifier labels for 2.6.0 and accurately describe the included migrations. The source kit's historical 2.5.2 labels are not proof of any included fix.
9. Validate backups and existing runtime configuration before migrations. Abort on missing upload storage, invalid database/upload archives, or missing private settings. Preserve backend images/configuration and never delete data volumes.
10. Keep rollback copies for app, launchers, runtime manifest, service and private configuration. Stop after the first failed migration; successful earlier migrations remain applied.
11. Regenerate `BUILD-INFO.json` and `CHECKSUMS.sha256` after the last change. Recursively inspect the final ZIP and verify all checksums. Do not include actual `.env`, keys, tunnel credentials, financial backups, customer uploads, logs, dependency folders or build caches.
12. Run safe local startup/asset checks, then a full upgrade on an isolated matching installation when available. Actual Dell browser checks remain required after owner-run deployment.

The supplied source handover says the previous ready-built 2.5.3 ZIP stopped at 0075 while the source contained 0076–0077. That claim has not been rechecked against the missing deployment ZIP in this workspace. The original supplied source files 0000–0077 were compared and verified byte-identical.

### Installer behavior to retain or verify against the actual baseline

- Require an existing `/opt/karatdesk/.env` and `/opt/karatdesk-backend/.env`, Docker, Python and Node 22+.
- Save private app/backend settings, keys, compose configuration, Nginx, tunnel and schedules to protected backup directories.
- Back up PostgreSQL and uploaded bytes **before** applying migrations; validate both archives and stop on failure. Missing expected storage is not a successful upload backup.
- Apply pending migration filenames in order with tracking inserts in the same transaction. Do not mark a failed file as applied.
- Preserve app/backend settings and private localhost ports. The original script invokes `docker compose up -d`; this may reconcile containers. Do not claim that containers can never change.
- Swap app output, clear only generated runtime copies, check startup and every public JavaScript response. On startup failure restore compatible app/launcher/configuration copies.
- Modify only intended Nginx locations, test before reload, restore working Nginx files if validation fails. Keep listeners, certificates, redirects and tunnel credentials.
- Skip Certbot in tunnel mode. Test localhost and public-domain runtime/assets and print the backup paths and verification command.

## 8. Installation commands — only after the final ZIP exists

These commands describe the intended **future final** 2.6.0 upgrade, not a ZIP already delivered. Do not run the source kit's original `self-hosted/install.sh` on production.

Use the owner's existing SSH account and Dell address; they have not been supplied in this handover.

```bash
# Transfer the final upgrade ZIP with the owner's existing SSH connection.
# On the Dell, make a new staging directory; do not overwrite old ZIPs.
mkdir -p ~/karatdesk-releases/2.6.0
cd ~/karatdesk-releases/2.6.0
# Place karatdesk-dell-v2.6.0-upgrade.zip in this directory first.
unzip karatdesk-dell-v2.6.0-upgrade.zip -d .
cd karatdesk-dell-v2.6.0
sha256sum -c CHECKSUMS.sha256

# After reviewing the final installer and checking backups:
sudo bash install.sh --tunnel pos.cityjewels.store
sudo bash /opt/karatdesk/deploy/verify-deployment.sh pos.cityjewels.store
```

There is already a root directory inside the expected ZIP. Do not extract with `-d karatdesk-dell-v2.6.0` and then accidentally enter a second nested directory.

No certificate email is needed in tunnel mode. Do not reconfigure Cloudflare routing or run owner setup during an existing-server upgrade.

## 9. Private runtime settings and provider setup

The browser receives only the public base and publishable key from `/api/public/runtime-config`. On Dell the public base is the same-origin `/sb`; server requests use the private localhost backend. Privileged keys and job secrets must never appear in browser bundles or this public response.

Retain the existing private settings by name; no secret values are supplied here:

```text
SUPABASE_URL                  private server backend URL
SUPABASE_PUBLIC_URL           same-origin browser base, /sb
SUPABASE_PUBLISHABLE_KEY       existing public backend key
SUPABASE_SERVICE_ROLE_KEY      existing privileged server-only key
LOVABLE_CRON_SECRET            existing server-only job verification secret
RESEND_API_KEY                 retained email provider key, if configured
PORT                          3000
HOST                          127.0.0.1
KD_SELF_HOSTED                 1
KD_DATA_DIR                   /opt/karatdesk
KD_HOST_PROVIDER              Dell server
```

These variable names are implementation identifiers, not an instruction to replace values. Keep real `.env` privately on the Dell with mode 600. Do not print it, paste keys into chat, or copy hosted-preview credentials into the Dell build. Lovable Cloud's privileged key and database password are not available for export.

Retain the existing Resend integration code. A fresh Resend connection and authorized sender are still needed for this workspace's email verification. Invitations, verified-email recovery and scheduled email delivery are not verified here. The Dell's actual email configuration and SMTP environment must be checked separately and privately.

## 10. SQL history, access boundaries and restore

Application schema and permission functions stay in `public`. Preserve row access rules, grants, branch scope and protected role assignment. Complete source includes journal/snapshot metadata; never regenerate old migrations merely to change their names or bytes.

| Migration | Relevant purpose |
|---|---|
| 0067 | Restored runtime/database functions |
| 0068 | Atomic record restore |
| 0069 | Safe sequence/tag parsing |
| 0070 | Preserve branch/payment records during restore |
| 0071 | Default petty-cash categories for new branches |
| 0072 | Owner guard for `save_staff_access` |
| 0073 | Full restore compatible with safe-update rules |
| 0074 | Factory reset compatible with safe-update rules |
| 0075 | Missing backup columns keep database defaults |
| 0076 | Privileged restore RPC is server-only |
| 0077 | Set owner identity and assurance before restore checks |
| 0078 | **Preview-only schema comment; omitted from Dell output** |

### Atomic application restore path

1. Owner chooses backup and branches and confirms a real password against fresh runtime configuration.
2. Authenticated server logic verifies owner authority, selected branch IDs and input limits; empty or over-200,000-row input is rejected.
3. Metals are matched by name rather than installation-specific IDs. Restore plans account for dependent records and selected branches.
4. Only after authorization does the server load the privileged client.
5. The RPC is `kd_restore_records(p_plans jsonb, p_actor uuid, p_aal text)`. Only the privileged server role can execute it; public/anonymous/browser-authenticated roles cannot.
6. SQL sets owner identity/authentication assurance before checking owner/MFA permission, restores dependencies transactionally, keeps defaults for older missing columns and returns the restored count.

Never restore the older browser-executable privileged function or remove owner/MFA checks. Do not treat a previously reported fixed restore finding as proof that all unrelated security findings are fixed.

Application JSON restore intentionally preserves login identities, branch definitions, shop settings and the metal directory. It does not restore the full authentication system or uploaded file bytes.

## 11. Backups, rollback and disaster recovery

### Three different backup types

| Backup | Contains / limitation |
|---|---|
| In-app JSON | Application records; not a complete server image and not private upload bytes |
| PostgreSQL dump | Records, identities, settings and storage metadata; not upload bytes |
| Uploaded-file archive | Private file bytes; must correspond to the database metadata |

Full recovery also needs protected matching app/backend configuration, keys and tunnel settings. Keep backups off the Dell; same-disk archives do not protect against disk/server loss. The original local schedule documents 14-day retention, but live cron/timer operation has not been inspected.

Additional local backup command on an existing configured server:

```bash
sudo bash /opt/karatdesk/deploy/backup-now.sh
```

Verify SQL with `gzip -t`, uploaded files with `tar -tzf`, and reasonable non-empty sizes. These are archive-integrity checks, not proof of recoverability. Perform a full test restore on an isolated matching installation before relying on a backup.

### App rollback

Inspect the actual `app.previous`, protected pre-upgrade copies and compatibility first. During downtime, stop the service, retain the failed release, restore the matching previous app/launchers/runtime manifest/service/private settings, clear the generated `.runtime` copy and restart. Keep failed-release copies for diagnosis.

An app rollback **does not undo successful migrations**. In particular, old compiled restore callers may not match the server-only RPC signature introduced by 0076–0077. Do not promise a one-command rollback to an arbitrary old app after changing the restore RPC.

### Full disaster recovery

Select one explicit verified SQL archive and its matching uploads. Never combine wildcard-selected dumps. Recovery can replace financial records and authentication identities, so test on an isolated server first and require planned downtime/owner authorization for production restoration.

Restore database metadata and file bytes consistently, check storage ownership, restart dependent services, and verify owner/staff sign-in, financial totals and private photo access before reopening. Do not include actual backups in these source/deployment deliverables.

**Never run on production:** backend reset scripts, `docker compose down -v`, deletion of backend volumes, or first-owner setup. The upstream backend source retains historical utility scripts for completeness; their presence is not permission to execute them.

## 12. Dell hardware, PWA, barcodes and assets

The Linux-only System health overlay reads host model, available RAM, filesystem capacity, battery and charger status. `KD_SELF_HOSTED=1` enables self-host behavior; `KD_DATA_DIR` selects the relevant filesystem. Unsupported readings remain unavailable/no battery rather than fabricated. These OS reads do not belong in the Cloud runtime.

The self-host build overlays local PWA icons, manifest and service worker into public output. The source includes original local icons. Preserve existing barcode/QR flows. After deployment, confirm labels scan and private photos are visible only to permitted users.

`start.mjs` copies compiled output into `.runtime` without rewriting hashed JavaScript. `verify-assets.mjs` compares every served JavaScript response byte-for-byte with packaged output and rejects exposed privileged fields in runtime configuration. Keep this compatibility path and do not replace it with runtime text substitution.

## 13. Verification performed in this task

- **255 application tests passed in 49 suites**, including the local-account and restore-password regression tests.
- **Nine original hosting tests passed.** Two new build-assembly tests check production migration preservation and preview-comment exclusion.
- Isolated Node compilation succeeded for the 2.6.0 application using the self-host overlays and sanitized inherited environment.
- The compiled server started locally on a separate port with disposable placeholder settings; `/api/public/runtime-config` returned the same-origin `/sb` public base without privileged fields.
- **122 public JavaScript responses matched packaged files byte-for-byte.** This is an asset/startup smoke check, not a real signed-in workflow.
- Real inherited backend/email/job configuration values were checked for accidental matches in compiled output; no matches were found in the inspected build.
- All **78 original production SQL files** matched the supplied source ZIP byte-for-byte. The extra preview-only comment was identified separately.
- All **35 content routes** were inspected for app-specific title/description and social metadata, including the index route. No missing required content-route metadata was detected.
- Source and delivered archive checks are recorded in the separate verification report. Read that report for the final performed/not-performed distinction.

### Not performed

- No SSH connection to Dell, installation, production database write/reset, volume deletion, key change, tunnel change or Lovable publication.
- No full upgrade test against the missing prior deployment archive or a matching running local backend.
- No real owner/staff authenticated workflow in the compiled Node build.
- No real password-confirmed production restore, private photo test, TOTP test or owner 166-record backup restore.
- No imported-user first login or ownership check; application/user exports and upload bytes have not been supplied.
- No live Resend/scheduled-email verification in this workspace.

## 14. Checks the owner must run after the final upgrade

```bash
sudo bash /opt/karatdesk/deploy/verify-deployment.sh pos.cityjewels.store
sudo nginx -t
sudo systemctl status karatdesk --no-pager
sudo systemctl status cloudflared --no-pager
sudo journalctl -u karatdesk -n 100 --no-pager
```

Inspect logs privately and redact sensitive values before sharing. Do not paste environment files or authentication tokens.

Browser checklist:

1. Confirm the displayed version is 2.6.0 and required production migration tracking is current through 0077.
2. Sign in as the existing owner with real credentials; complete TOTP if enabled. Sign in as an existing assigned-branch staff member.
3. Verify existing stock, sales, jobs, balances, cheques and private photos survived. Compare representative financial totals with pre-upgrade records.
4. In Users, create a local staff account with email empty, an existing approved role and intended branches. Sign in with its username/password and check assigned permissions. Remove a temporary account only with owner approval.
5. Confirm restore password verification with the real owner password. Test all-branch, single-branch and older-backup behavior on an isolated copy first; do not restore production casually during trading.
6. Specifically verify the owner's 166-record backup on the appropriate authorized installation and record the actual result. No such success is claimed here.
7. Verify invalid passwords still fail, unauthorized users cannot call restore, and enabled MFA remains enforced.
8. Confirm QR/barcode labels, local PWA assets, private uploads/downloads and Dell hardware readings.
9. Verify the public runtime base remains `/sb`, public assets match the package, private ports remain private and tunnel/HTTPS routing remains unchanged.
10. Verify schedules, local full backups, off-server copies and email delivery with the actual configured provider.

## 15. Remaining work and next-chat instructions

| Open item | Concrete next action |
|---|---|
| Final 2.6.0 Dell upgrade ZIP | Attach the previous ready-built Dell upgrade ZIP; preserve/compare it, then finish in-place assembly and checksums |
| Dell deployment and production verification | Owner runs the final installer and checklist, then supplies redacted actual results |
| Preview authenticated CRUD/local login | A preview sign-in is needed; the temporary test-account permission was previously declined |
| Existing application records and identities in preview | Supply appropriate application/user exports; preserve ownership through verified identity mapping |
| Existing private photos in preview | Supply metadata and bytes separately; do not confuse source assets with customer uploads |
| Email and scheduled email backups | Fresh Resend connection and authorized sender; verify actual delivery |
| Imported-user verification/new password/ownership | Requires user exports and supported first-login verification, not old password/session transfer |
| Publication/cutover | Separate owner-authorized decision; not performed here |

The previous Cloud restoration recreated the schema/access rules and private photo buckets, not the existing production dataset. Database/users moving into a future Cloud workspace require verified identity ownership; old passwords and sessions do not transfer. Existing Dell identities remain untouched during a normal in-place code upgrade.

### Copy/paste introduction for a new chat

> Continue KaratDesk, the existing jewellery POS at https://pos.cityjewels.store on an Ubuntu Dell behind Cloudflare Tunnel and Nginx. Read the attached 2.6.0 source ZIP, full handover and verification report before changing anything. The owner approved version 2.6.0. Source contains the email-free local staff correction, fresh runtime restore-password configuration and legacy real-email gateway correction, plus server-only owner/MFA-protected atomic restore through production migration 0077. The source's 0078 is a preview-only schema comment and must not go to Dell. The final Dell upgrade ZIP is still pending the previous deployment ZIP: evolve that package in place, keep old SQL byte-identical, preserve its 60 MB/300-second restore settings and trusted password-gateway routing. Never reset the existing backend, run owner setup or replace keys, tunnel/HTTPS configuration, records or uploads. Back up and validate before migrations. Production and real authenticated restore remain unverified; the 166-record backup has not been proven restored here. Resend/data/identities/private upload migration remain separate blockers. Preserve TanStack package pins, existing POS formatting, roles and Linux-only overlays. Report actual checks and remaining actions honestly.