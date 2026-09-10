#!/usr/bin/env bash
# Daily pg_dump of the full gymind database (all tables - user data
# included, not just the food/exercise reference set that
# scripts/seed_reference_data.py covers). Meant to run via cron on the
# server, not from a dev machine - see PROJECT_STATUS.md's "Backups"
# section for the crontab line and restore steps.
#
# Keeps the last 7 daily dumps and deletes anything older; simple
# rotation, no external tooling. Runs `docker compose exec` against the
# db service directly rather than requiring psql/pg_dump installed on
# the host.
set -euo pipefail

REPO_DIR="/DATA/gymind"
BACKUP_DIR="/DATA/gymind-backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/gymind_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

cd "$REPO_DIR"
docker compose exec -T db pg_dump -U gymind gymind | gzip > "$OUT_FILE"

# Sanity check: a truncated/empty dump is worse than no dump, since it
# would silently satisfy the "a backup ran today" expectation without
# actually being restorable.
if [ ! -s "$OUT_FILE" ]; then
    echo "backup_db.sh: $OUT_FILE is empty, dump failed" >&2
    rm -f "$OUT_FILE"
    exit 1
fi

find "$BACKUP_DIR" -name 'gymind_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "backup_db.sh: wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
