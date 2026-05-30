#!/bin/env bash
# ==============================================================================
# RESTOPRO ENTERPRISE ROS - AUTONOMOUS REPLICATED BACKUP & RETENTION ENGINE
# ==============================================================================
# This script executes scheduled snapshots of the primary MongoDB cluster,
# compresses, cryptographically hashes the output, and purges archives older
# than 14 retention cycles. Designed to run as a systemd timer or crontab hook.
# ==============================================================================

set -euo pipefail

# Configuration parameters
BACKUP_DIR="/var/backups/restopro"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="restopro_prod"
REPLICA_SET_URI="mongodb://mongo1:27017,mongo2:27018,mongo3:27019/${DATABASE_NAME}?replicaSet=rsProd"
SLACK_HEALTH_WEBHOOK="${BACKUP_ALERTS_WEBHOOK:-}"

echo "[${TIMESTAMP}] [INFO] Starting autonomous hot backup sequence..."

# 1. Guarantee backup directory index exists
mkdir -p "${BACKUP_DIR}"

# 2. Extract database state under consistent read concern
BACKUP_FILE="${BACKUP_DIR}/snap_${DATABASE_NAME}_${TIMESTAMP}.tar.gz"
TEMP_DUMP_DIR=$(mktemp -d)

echo "[INFO] Commencing dump to temporary staging workspace: ${TEMP_DUMP_DIR}..."

if mongodump --uri="${REPLICA_SET_URI}" --out="${TEMP_DUMP_DIR}" --gzip --oplog; then
    echo "[INFO] Database dump extracted cleanly. Compressing workspace..."
    tar -czf "${BACKUP_FILE}" -C "${TEMP_DUMP_DIR}" .
    rm -rf "${TEMP_DUMP_DIR}"
    
    FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    SHA256_HASH=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)
    
    echo "[SUCCESS] Hot-snapshot compiled: ${BACKUP_FILE} (Size: ${FILE_SIZE})"
    echo "[SUCCESS] Cryptographic Verify SHA256 SHA-Key: ${SHA256_HASH}"
    
    # Optional Slack Webhook Notification Alert Trigger
    if [ -n "${SLACK_HEALTH_WEBHOOK}" ]; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"[BACKUP SUCCESS] RestoPro Branch database snapshot created. Timestamp: ${TIMESTAMP}, File: snap_${DATABASE_NAME}_${TIMESTAMP}.tar.gz, Size: ${FILE_SIZE}, Checksum: ${SHA256_HASH}\"}" \
          "${SLACK_HEALTH_WEBHOOK}" || true
    fi
else
    echo "[CRITICAL_ERROR] mongodump procedure crashed with exit code $?. Purging work state..."
    rm -rf "${TEMP_DUMP_DIR}"
    
    if [ -n "${SLACK_HEALTH_WEBHOOK}" ]; then
        curl -X POST -H 'Content-type: application/json' \
          --data "{\"text\":\"[BACKUP FAILURE] RESTOPRO DATABASE CRITICAL: Backup script failed to serialize dump snapshot! Hot failover checks are advised.\"}" \
          "${SLACK_HEALTH_WEBHOOK}" || true
    fi
    exit 1
fi

# 3. Purge historical records matching retention parameters
echo "[INFO] Cleaning archival indexes older than ${RETENTION_DAYS} retention days..."
find "${BACKUP_DIR}" -type f -name "snap_${DATABASE_NAME}_*.tar.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

echo "[SUCCESS] Outdated retention histories successfully rotated out."
