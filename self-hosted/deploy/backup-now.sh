#!/usr/bin/env bash
# Nightly local backup: full PostgreSQL SQL plus the separately stored uploaded files.
set -euo pipefail
BACKEND=/opt/karatdesk-backend
DEST=/var/backups/karatdesk
STAMP="$(date +%F)"
mkdir -p "$DEST"
TMP_DB="$DEST/.db-$STAMP.sql.gz.tmp"
TMP_FILES="$DEST/.files-$STAMP.tar.gz.tmp"
rm -f "$TMP_DB" "$TMP_FILES"
docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists --no-owner --no-privileges | gzip > "$TMP_DB"
mv "$TMP_DB" "$DEST/db-$STAMP.sql.gz"
if [ -d "$BACKEND/volumes/storage" ]; then
  tar -czf "$TMP_FILES" -C "$BACKEND" volumes/storage
  mv "$TMP_FILES" "$DEST/files-$STAMP.tar.gz"
fi
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'files-*.tar.gz' -mtime +14 -delete
echo "Backup complete: $DEST/db-$STAMP.sql.gz"
if [ -f "$DEST/files-$STAMP.tar.gz" ]; then echo "Uploaded files: $DEST/files-$STAMP.tar.gz"; fi
