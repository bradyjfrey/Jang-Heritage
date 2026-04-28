#!/usr/bin/env bash
# Postgres backup. Reads DATABASE_URL from .env, runs pg_dump in custom
# format (compressed, restorable via pg_restore), writes a timestamped
# file to BACKUP_DIR (default ./backups, gitignored).
#
# Local use:
#   bash scripts/backup-pg.sh
#
# Prod (Dokploy or similar): set BACKUP_DIR to a mounted volume or sync
# the resulting file off-host (rclone to a separate R2 bucket, etc.).
#
# Restore:
#   pg_restore --clean --if-exists -d "$DATABASE_URL" backups/<file>.dump
set -euo pipefail

# Pull DATABASE_URL out of .env without sourcing (avoids choking on
# values containing whitespace).
if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^# ]] && continue
    [[ -z "$key" ]] && continue
    if [[ "$key" == "DATABASE_URL" ]]; then
      value="${value%\"}"; value="${value#\"}"
      export DATABASE_URL="$value"
      break
    fi
  done < .env
fi

: "${DATABASE_URL:?DATABASE_URL not set (in .env or environment)}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

stamp=$(date +%Y%m%d-%H%M%S)
out="$BACKUP_DIR/jang-heritage-$stamp.dump"

echo "Backing up Postgres → $out"
pg_dump --format=custom --no-owner --no-privileges --file "$out" "$DATABASE_URL"

bytes=$(stat -f %z "$out" 2>/dev/null || stat -c %s "$out" 2>/dev/null || echo "?")
echo "Done. $bytes bytes."

# Prune backups older than RETENTION_DAYS (default 14). Set RETENTION_DAYS=0
# to disable pruning entirely.
retention="${RETENTION_DAYS:-14}"
if (( retention > 0 )); then
  find "$BACKUP_DIR" -name 'jang-heritage-*.dump' -type f -mtime +"$retention" -print -delete || true
fi
